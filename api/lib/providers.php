<?php
// The only place that talks to an AI company. The API key is added here, on the server, and goes
// nowhere else: not to the browser, not into logs, not into error messages.
// Both providers get the same input and return the same result:
//   ['ok' => true,  'json' => parsed answer, 'assistant' => what to keep in the conversation history]
//   ['ok' => false, 'error' => short internal code]   (visitors only ever see a generic message)
declare(strict_types=1);
if (!defined('INKLINE')) { http_response_code(404); exit; }

function http_post_json(string $url, array $headers, array $body, int $timeout): array {
    // Only HTTPS to the real provider. Plain http is allowed for a local test server only.
    $scheme = parse_url($url, PHP_URL_SCHEME);
    $host = parse_url($url, PHP_URL_HOST);
    $local = in_array($host, ['127.0.0.1', 'localhost', '::1'], true);
    if ($scheme !== 'https' && !($scheme === 'http' && $local)) return [0, null, 'bad_base_url'];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_FOLLOWLOCATION => false,   // never follow a redirect with the key attached
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | ($local ? CURLPROTO_HTTP : 0),
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $resp = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = $resp === false ? 'network' : null;
    unset($ch);   // frees the connection (curl_close is a no-op and deprecated in PHP 8.5)
    $data = is_string($resp) ? json_decode($resp, true) : null;
    return [$status, is_array($data) ? $data : null, $err];
}

// $messages: the conversation, as [['role' => 'user'|'assistant', 'content' => string or provider blocks]]
// $files: checked uploads for this turn only (PDFs and images), attached to the last user message.
function ai_call(string $system, array $messages, array $schema, array $files = []): array {
    $s = settings();
    if ($s['key'] === '') return ['ok' => false, 'error' => 'not_configured'];
    $started = microtime(true);
    $result = $s['provider'] === 'openai'
        ? openai_call($s, $system, $messages, $schema, $files)
        : anthropic_call($s, $system, $messages, $schema, $files);
    $result['latency_ms'] = (int)round((microtime(true) - $started) * 1000);
    return $result;
}

// ---------- OpenAI: Responses API ----------
function openai_call(array $s, string $system, array $messages, array $schema, array $files): array {
    $input = [];
    $last = count($messages) - 1;
    foreach ($messages as $i => $m) {
        $text = is_string($m['content']) ? $m['content'] : flatten_text($m['content']);
        if ($m['role'] === 'user' && $i === $last && $files) {
            $parts = [];
            foreach ($files as $n => $f) {
                $dataUrl = 'data:' . $f['media_type'] . ';base64,' . $f['data'];
                $parts[] = $f['media_type'] === 'application/pdf'
                    ? ['type' => 'input_file', 'filename' => 'cv-' . ($n + 1) . '.pdf', 'file_data' => $dataUrl]
                    : ['type' => 'input_image', 'image_url' => $dataUrl, 'detail' => 'high'];
            }
            $parts[] = ['type' => 'input_text', 'text' => $text];
            $input[] = ['role' => 'user', 'content' => $parts];
        } else {
            $input[] = ['role' => $m['role'] === 'assistant' ? 'assistant' : 'user', 'content' => $text];
        }
    }
    $body = [
        'model' => $s['model'],
        'instructions' => $system,
        'input' => $input,
        'max_output_tokens' => $s['max_output_tokens'],
        'store' => false,                                   // don't keep visitors' CVs on OpenAI's side
        'safety_identifier' => $GLOBALS['INKLINE_CLIENT'],  // anonymous tag that helps OpenAI spot abuse
        'text' => ['format' => ['type' => 'json_schema', 'name' => 'inkline_answer', 'schema' => $schema, 'strict' => true]],
    ];
    if ($s['reasoning_effort'] !== '' && $s['reasoning_effort'] !== 'off') $body['reasoning'] = ['effort' => $s['reasoning_effort']];
    [$status, $data, $err] = http_post_json($s['base_url'] . '/responses', [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $s['key'],
    ], $body, $s['timeout']);
    $usage = ['input_tokens' => (int)($data['usage']['input_tokens'] ?? 0), 'output_tokens' => (int)($data['usage']['output_tokens'] ?? 0)];
    if ($err) return ['ok' => false, 'error' => $err] + $usage;
    if ($status !== 200 || !$data) return ['ok' => false, 'error' => 'http_' . $status, 'error_type' => (string)($data['error']['type'] ?? $data['error']['code'] ?? '')] + $usage;
    if (($data['status'] ?? '') === 'incomplete') return ['ok' => false, 'error' => 'incomplete_' . ($data['incomplete_details']['reason'] ?? 'unknown')] + $usage;
    $text = ''; $refused = false;
    foreach ($data['output'] ?? [] as $item) {
        if (($item['type'] ?? '') !== 'message') continue;
        foreach ($item['content'] ?? [] as $part) {
            if (($part['type'] ?? '') === 'output_text') $text .= $part['text'] ?? '';
            if (($part['type'] ?? '') === 'refusal') $refused = true;
        }
    }
    if ($refused && $text === '') return ['ok' => false, 'error' => 'refusal'] + $usage;
    $json = json_decode($text, true);
    if (!is_array($json)) return ['ok' => false, 'error' => 'format'] + $usage;
    return ['ok' => true, 'json' => $json, 'assistant' => $text] + $usage;
}

// ---------- Anthropic: Messages API ----------
function anthropic_call(array $s, string $system, array $messages, array $schema, array $files): array {
    $msgs = [];
    $last = count($messages) - 1;
    foreach ($messages as $i => $m) {
        if ($m['role'] === 'user' && $i === $last && $files) {
            $blocks = [];
            foreach ($files as $f) {
                $src = ['type' => 'base64', 'media_type' => $f['media_type'], 'data' => $f['data']];
                $blocks[] = $f['media_type'] === 'application/pdf' ? ['type' => 'document', 'source' => $src] : ['type' => 'image', 'source' => $src];
            }
            $blocks[] = ['type' => 'text', 'text' => is_string($m['content']) ? $m['content'] : flatten_text($m['content'])];
            $msgs[] = ['role' => 'user', 'content' => $blocks];
        } else {
            $msgs[] = ['role' => $m['role'], 'content' => $m['content']];   // assistant turns keep their blocks unchanged
        }
    }
    $body = [
        'model' => $s['model'],
        'max_tokens' => $s['max_output_tokens'],
        'system' => [['type' => 'text', 'text' => $system, 'cache_control' => ['type' => 'ephemeral']]],
        'messages' => $msgs,
        'cache_control' => ['type' => 'ephemeral'],
        'output_config' => ['format' => ['type' => 'json_schema', 'schema' => $schema]],
    ];
    $headers = ['Content-Type: application/json', 'x-api-key: ' . $s['key'], 'anthropic-version: 2023-06-01'];
    if (strpos($s['model'], 'claude-haiku') !== 0) {
        $body['output_config']['effort'] = 'low';
        $body['fallbacks'] = 'default';
        $headers[] = 'anthropic-beta: server-side-fallback-2026-07-01';
    }
    [$status, $data, $err] = http_post_json($s['base_url'] . '/v1/messages', $headers, $body, $s['timeout']);
    $usage = ['input_tokens' => (int)($data['usage']['input_tokens'] ?? 0), 'output_tokens' => (int)($data['usage']['output_tokens'] ?? 0)];
    if ($err) return ['ok' => false, 'error' => $err] + $usage;
    if ($status !== 200 || !$data) return ['ok' => false, 'error' => 'http_' . $status, 'error_type' => (string)($data['error']['type'] ?? '')] + $usage;
    $stop = $data['stop_reason'] ?? '';
    if ($stop === 'refusal') return ['ok' => false, 'error' => 'refusal'] + $usage;
    if ($stop === 'max_tokens') return ['ok' => false, 'error' => 'incomplete_max_output_tokens'] + $usage;
    $text = '';
    foreach ($data['content'] ?? [] as $b) if (($b['type'] ?? '') === 'text') $text .= $b['text'];
    $json = json_decode($text, true);
    if (!is_array($json)) return ['ok' => false, 'error' => 'format'] + $usage;
    return ['ok' => true, 'json' => $json, 'assistant' => $data['content']] + $usage;
}

function flatten_text($content): string {
    if (is_string($content)) return $content;
    $t = '';
    foreach ((array)$content as $b) if (is_array($b) && ($b['type'] ?? '') === 'text') $t .= $b['text'] ?? '';
    return $t;
}
