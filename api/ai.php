<?php
// Inkline AI endpoint. The browser talks only to this file; this file talks to the AI provider.
//
//   GET                         -> { ai: true|false }                  is the AI switched on?
//   POST { action: "start" }    -> a new CV conversation (no AI call; counts toward the daily CV limit)
//   POST { action: "chat" }     -> one interview turn: the visitor's new message only
//   POST { action: "import" }   -> read an uploaded old CV (PDF, images, or text taken from a document)
//   POST { action: "end" }      -> delete the visitor's conversation from the server right away
//
// Every check happens here on the server: request shape, speed limits, daily limits, sizes, file types.
// Conversations are stored on the server, so the browser never sends (or can fake) the history.
// Privacy: uploaded files are never saved, photos never arrive here, conversations are deleted
// automatically after CONVERSATION_RETENTION_HOURS, and nothing personal is written to the logs.
declare(strict_types=1);
define('INKLINE', true);
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/log.php';
require __DIR__ . '/lib/limits.php';
require __DIR__ . '/lib/validate.php';
require __DIR__ . '/lib/prompts.php';
require __DIR__ . '/lib/providers.php';

$S = settings();
$GLOBALS['INKLINE_CLIENT'] = client_id();
maybe_cleanup();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_out(200, ['ai' => $S['key'] !== '' && function_exists('curl_init')]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'method_not_allowed', 'Not allowed.', [], ['Allow' => 'GET, POST']);
if ($S['key'] === '') fail(503, 'not_configured', 'The AI is not switched on yet.');

// 1. Shape: from this site's page, as JSON, a sensible size.
check_request_shape();
$raw = file_get_contents('php://input', false, null, 0, $S['max_body_bytes'] + 1);
if ($raw === false || strlen($raw) > $S['max_body_bytes']) {
    log_event('upload_rejected', ['reason' => 'body_too_large']);
    fail(413, 'too_large', 'That is too much to send at once.');
}

$in = json_decode($raw, true);
if (!is_array($in)) { log_event('request_rejected', ['reason' => 'bad_json']); fail(400, 'bad_request', 'The request could not be read.'); }
$action = $in['action'] ?? '';
if (!in_array($action, ['start', 'chat', 'import', 'end'], true)) { log_event('request_rejected', ['reason' => 'bad_action']); fail(400, 'bad_request', 'Unknown request.'); }

// ---------- conversations, stored on the server ----------
function conv_path(string $id): string { return data_dir('conv') . '/' . $id . '.json'; }

// Deleting your chat costs nothing and is never rate limited.
if ($action === 'end') {
    $id = valid_conversation_id($in['conversation'] ?? null);
    if ($id && is_file(conv_path($id))) { @unlink(conv_path($id)); log_event('conversation_deleted'); }
    json_out(200, ['ok' => true]);
}

// 2. Speed limits, before the expensive work, so floods are cheap to turn away.
enforce_rate_limits(hash('sha256', $raw));

function conv_expired(array $conv): bool {
    return (time() - (int)($conv['created'] ?? 0)) > settings()['retention_hours'] * 3600;
}

function new_conversation(?array $cv): array {
    $id = bin2hex(random_bytes(16));
    $open = opening_turns($cv);
    $conv = ['id' => $id, 'provider' => settings()['provider'], 'model' => settings()['model'], 'created' => time(), 'turns' => 0, 'history' => $open['history']];
    file_put_contents(conv_path($id), json_encode($conv, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    @chmod(conv_path($id), 0600);
    log_event('conversation_started', ['provider' => $conv['provider']]);
    return [$conv, $open];
}

// Keeps a long conversation within budget: older turns are folded into a short note with the current CV.
function trim_history(array $history, array $cv): array {
    $size = strlen(json_encode($history, JSON_UNESCAPED_UNICODE));
    if ($size <= settings()['max_history_chars']) return $history;
    $tail = array_slice($history, -6);
    foreach ($tail as &$m) if (!is_string($m['content'])) $m['content'] = flatten_text($m['content']);   // drop provider-specific blocks
    unset($m);
    return array_merge([
        ['role' => 'user', 'content' => "(We are continuing an earlier conversation. The CV so far:)\n" . json_encode($cv, JSON_UNESCAPED_UNICODE)],
        ['role' => 'assistant', 'content' => json_encode(['reply' => "Let's carry on.", 'quick_replies' => [], 'stage' => 'review', 'show_designs' => false, 'suggested_templates' => [], 'cv' => $cv], JSON_UNESCAPED_UNICODE)],
    ], $tail);
}

function ai_failed(array $r, string $action): void {
    log_event('api_error', ['action' => $action, 'provider' => settings()['provider'], 'reason' => $r['error'] ?? 'unknown',
        'error_type' => $r['error_type'] ?? '', 'latency_ms' => $r['latency_ms'] ?? 0]);
    $busy = in_array($r['error'] ?? '', ['http_429', 'http_529', 'http_503'], true);
    fail($busy ? 503 : 502, 'ai_unavailable', $busy
        ? 'The AI is very busy right now. Please try again in a minute.'
        : "Sorry, the AI couldn't answer just now. Please try again.");
}

// ---------- start: a new CV ----------
if ($action === 'start') {
    $cv = isset($in['cv']) && is_array($in['cv']) ? normalize_cv($in['cv']) : null;
    enforce_daily_limits(false, true, false);
    [$conv, $open] = new_conversation($cv);
    json_out(200, ['ok' => true, 'conversation' => $conv['id'], 'greeting' => $open['greeting'], 'quick_replies' => $open['quick_replies']]);
}

// ---------- chat: one interview turn ----------
if ($action === 'chat') {
    $id = valid_conversation_id($in['conversation'] ?? null);
    $input = clean_text($in['input'] ?? '', $S['max_message_chars'] + 1);
    if ($input === '') { log_event('request_rejected', ['reason' => 'empty_input']); fail(400, 'bad_request', 'Please type a message.'); }
    if (mb_strlen($input) > $S['max_message_chars']) {
        log_event('request_rejected', ['reason' => 'input_too_long', 'chars' => mb_strlen($input)]);
        fail(413, 'too_long', 'That message is too long. Please keep it under ' . $S['max_message_chars'] . ' characters.');
    }
    $editedCv = isset($in['cv']) && is_array($in['cv']) ? normalize_cv($in['cv']) : null;
    if (!$id || !is_file(conv_path($id))) fail(404, 'conversation_expired', 'This chat has expired. Starting a fresh one.');

    $result = with_json_file(conv_path($id), function (array $conv) use ($S, $input, $editedCv) {
        if (($conv['provider'] ?? '') !== $S['provider'] || empty($conv['history']) || conv_expired($conv)) return ['expired' => true];
        if ((int)$conv['turns'] >= $S['max_turns']) return ['too_many_turns' => true];
        enforce_daily_limits(true, false, false);
        $content = $editedCv
            ? "Note: I edited my CV directly. This is the current version:\n" . json_encode($editedCv, JSON_UNESCAPED_UNICODE) . "\n\nMy message: " . $input
            : $input;
        $lastCv = $editedCv ?? (json_decode(flatten_text(end($conv['history'])['content']), true)['cv'] ?? []);
        $history = trim_history($conv['history'], normalize_cv($lastCv));
        $history[] = ['role' => 'user', 'content' => $content];
        $r = ai_call(chat_system_prompt(), $history, chat_schema());
        if (!$r['ok']) return ['failed' => $r];
        $history[] = ['role' => 'assistant', 'content' => $r['assistant']];
        $conv['history'] = $history;
        $conv['turns'] = (int)$conv['turns'] + 1;
        return ['__save' => $conv, '__return' => ['r' => $r, 'turn' => $conv['turns']]];
    });
    if (!empty($result['expired'])) { @unlink(conv_path($id)); fail(404, 'conversation_expired', 'This chat has expired. Starting a fresh one.'); }
    if (!empty($result['too_many_turns'])) {
        log_event('daily_limit', ['kind' => 'turns', 'limit' => $S['max_turns']]);
        fail(429, 'turn_limit', 'This CV chat has reached its length limit. Your CV is saved: you can keep editing it yourself, or start a new chat tomorrow.', ['kind' => 'turns']);
    }
    if (!empty($result['failed'])) ai_failed($result['failed'], 'chat');
    $r = $result['r'];
    log_event('request_ok', ['action' => 'chat', 'provider' => $S['provider'], 'model' => $S['model'], 'latency_ms' => $r['latency_ms'],
        'input_tokens' => $r['input_tokens'], 'output_tokens' => $r['output_tokens'], 'turn' => $result['turn']]);
    json_out(200, ['ok' => true, 'data' => clean_ai_reply($r['json'])]);
}

// ---------- import: read an old CV ----------
if ($action === 'import') {
    $files = isset($in['files']) ? validate_uploads($in['files']) : [];
    $text = isset($in['text']) ? validate_import_text($in['text']) : '';
    if (!$files && $text === '') reject_upload(400, 'empty', 'Please choose a file to upload.');
    $id = valid_conversation_id($in['conversation'] ?? null);
    $exists = $id && is_file(conv_path($id));
    enforce_daily_limits(true, !$exists, true);
    if (!$exists) { [$conv] = new_conversation(null); $id = $conv['id']; }

    // The file goes straight to the AI from memory. It is never written to disk.
    $ask = 'This is my old CV. Please read it and fill in my new CV from it.' . ($text !== '' ? "\n<old_cv>\n" . $text . "\n</old_cv>" : '');
    $r = ai_call(import_system_prompt(), [['role' => 'user', 'content' => $ask]], import_schema(), $files);
    unset($files, $raw, $in);
    if (!$r['ok']) ai_failed($r, 'import');
    $d = $r['json'];
    $cv = normalize_cv($d['cv'] ?? []);
    $reply = clean_text($d['reply'] ?? '', 1500) ?: "I've read your old CV and filled in your new one. What has changed since you wrote it?";
    $quick = array_slice(array_values(array_filter(array_map(fn($q) => clean_text($q, 60), is_array($d['quick_replies'] ?? null) ? $d['quick_replies'] : []))), 0, 4);

    // The interview continues from here, knowing the CV, without the file itself.
    with_json_file(conv_path($id), function (array $conv) use ($cv, $reply, $quick) {
        if (empty($conv['history'])) return null;
        $conv['history'][] = ['role' => 'user', 'content' => "I uploaded my old CV. These are the details found in it:\n" . json_encode($cv, JSON_UNESCAPED_UNICODE)];
        $conv['history'][] = ['role' => 'assistant', 'content' => json_encode(['reply' => $reply, 'quick_replies' => $quick, 'stage' => 'review', 'show_designs' => false, 'suggested_templates' => [], 'cv' => $cv], JSON_UNESCAPED_UNICODE)];
        return ['__save' => $conv];
    });
    log_event('request_ok', ['action' => 'import', 'provider' => $S['provider'], 'model' => $S['model'], 'latency_ms' => $r['latency_ms'],
        'input_tokens' => $r['input_tokens'], 'output_tokens' => $r['output_tokens']]);
    json_out(200, ['ok' => true, 'conversation' => $id, 'data' => ['reply' => $reply, 'quick_replies' => $quick, 'cv' => $cv]]);
}
