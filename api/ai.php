<?php
// Inkline AI: a small, locked-down bridge between the CV maker and the Claude API.
// Two jobs: the interview chat, and reading an old CV someone uploads.
// The browser sends the conversation or the file; this file adds the instructions, the CV format and the
// safety limits, calls Claude, and returns the result. The API key never leaves the server.

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// config.php holds the API key and is never committed; without it the AI simply stays off.
$config = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
$apiKey = trim((string)($config['anthropic_api_key'] ?? ''));
$model  = (string)($config['model'] ?? 'claude-opus-5-5');

function reply(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// GET ?status tells the page whether the AI is switched on, without calling Claude.
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    reply(200, ['ai' => $apiKey !== '' && function_exists('curl_init')]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['ok' => false, 'error' => 'method']);
if ($apiKey === '') reply(503, ['ok' => false, 'error' => 'not_configured']);

// Only accept calls from this site's own pages.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    $host = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
    if (!$originHost || strcasecmp($originHost, $host) !== 0) reply(403, ['ok' => false, 'error' => 'origin']);
}

// ---------- rate limits (file based, works on any shared host) ----------
function rate_ok(string $key, array $windows): bool {
    $dir = sys_get_temp_dir() . '/inkline-rl';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $file = $dir . '/' . hash('sha256', $key) . '.json';
    $fh = @fopen($file, 'c+');
    if (!$fh) return true; // never block real visitors because the temp folder is unavailable
    flock($fh, LOCK_EX);
    $now = time();
    $hits = json_decode(stream_get_contents($fh) ?: '[]', true);
    if (!is_array($hits)) $hits = [];
    $longest = max(array_keys($windows));
    $hits = array_values(array_filter($hits, fn($t) => is_int($t) && $t > $now - $longest));
    foreach ($windows as $seconds => $limit) {
        $inWindow = count(array_filter($hits, fn($t) => $t > $now - $seconds));
        if ($inWindow >= $limit) { flock($fh, LOCK_UN); fclose($fh); return false; }
    }
    $hits[] = $now;
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($hits));
    flock($fh, LOCK_UN); fclose($fh);
    return true;
}
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (!rate_ok('visitor:' . $ip, [600 => (int)($config['per_visitor_per_10_min'] ?? 30), 86400 => (int)($config['per_visitor_per_day'] ?? 200)])
    || !rate_ok('all:' . gmdate('Y-m-d'), [86400 => (int)($config['all_visitors_per_day'] ?? 3000)])) {
    reply(429, ['ok' => false, 'error' => 'busy']);
}

// An uploaded CV can be a few megabytes once encoded, so allow up to 12 MB in.
$raw = file_get_contents('php://input', false, null, 0, 12000000);
$in = json_decode($raw ?: '', true);
if (!is_array($in)) reply(400, ['ok' => false, 'error' => 'body']);
$action = ($in['action'] ?? 'chat') === 'import' ? 'import' : 'chat';

// ---------- the CV format, shared by both jobs ----------
$TEMPLATES = ['atlas', 'vertex', 'sage', 'bloom', 'noir', 'horizon', 'indigo', 'harbor', 'folio', 'meridian', 'ledger'];
$str = ['type' => 'string'];
$strList = ['type' => 'array', 'items' => $str];
$obj = fn(array $props) => ['type' => 'object', 'properties' => $props, 'required' => array_keys($props), 'additionalProperties' => false];
$cvSchema = $obj([
    'name' => $str, 'title' => $str, 'email' => $str, 'phone' => $str, 'location' => $str, 'link' => $str,
    'summary' => $str,
    'experience' => ['type' => 'array', 'items' => $obj([
        'role' => $str, 'company' => $str, 'location' => $str, 'start' => $str, 'end' => $str, 'bullets' => $strList,
    ])],
    'education' => ['type' => 'array', 'items' => $obj([
        'qualification' => $str, 'school' => $str, 'location' => $str, 'start' => $str, 'end' => $str, 'details' => $str,
    ])],
    'skills' => $strList,
    'languages' => $strList,
    'extras' => ['type' => 'array', 'items' => $obj(['heading' => $str, 'items' => $strList])],
]);

$writingRules = <<<'RULES'
How to write the CV:
- Write experience bullets as strong, honest lines. Start with an action verb, say what they did and what came of it, one or two lines each, two to four bullets per job. Keep their facts and their voice, fix grammar, and avoid buzzwords such as leverage, synergy, results-driven, dynamic, passionate, or seamless.
- Never invent facts, numbers, employers, dates, qualifications or skills. When a number would make a line stronger, ask for it instead of guessing.
- Write `summary` as two or three specific sentences, no clichés, once you know the job they want and something about their background.
- Keep dates as given, tidied, for example "2021", "Mar 2021" or "Present".
- Leave anything unknown empty: "" for text, [] for lists.
- Use `extras` for extra sections such as Certifications, Volunteering, Projects or Awards.
RULES;

if ($action === 'chat') {
    // ---------- validate the conversation ----------
    $messages = $in['messages'] ?? null;
    if (!is_array($messages) || count($messages) < 1 || count($messages) > 90) reply(400, ['ok' => false, 'error' => 'messages']);
    $allowedBlocks = ['text', 'thinking', 'redacted_thinking', 'fallback'];
    foreach (array_values($messages) as $i => $m) {
        $role = $m['role'] ?? '';
        $want = $i % 2 === 0 ? 'user' : 'assistant';
        if ($role !== $want) reply(400, ['ok' => false, 'error' => 'order']);
        $content = $m['content'] ?? null;
        if ($role === 'user') {
            if (!is_string($content) || $content === '' || mb_strlen($content) > 24000) reply(400, ['ok' => false, 'error' => 'user_content']);
        } else {
            if (is_string($content)) continue;
            if (!is_array($content)) reply(400, ['ok' => false, 'error' => 'assistant_content']);
            foreach ($content as $block) {
                if (!is_array($block) || !in_array($block['type'] ?? '', $allowedBlocks, true)) reply(400, ['ok' => false, 'error' => 'block']);
            }
        }
    }
    if (count($messages) % 2 === 0) reply(400, ['ok' => false, 'error' => 'last_turn']);

    $system = <<<PROMPT
You are the interviewer inside Inkline, a free CV maker. A visitor is chatting with you to build their CV. Ask friendly, simple questions one at a time, and write their CV as you go, so they watch it take shape beside the chat.

Who you are talking to: anyone looking for a job. Many are stressed, some are young, and many read English as a second language. Use plain everyday words and short sentences. Be warm and calm, never gushing.

How to interview:
- Ask one short question per message.
- Cover, roughly in this order: their name; the job they want; contact details (email, phone, city, and a website or LinkedIn if they have one); work experience, most recent first (job title, employer, city, dates, then what they did and achieved); education; skills; languages; anything else worth adding, such as volunteering, projects, certifications or awards.
- Adapt to the person. Someone with little work history gets more questions about school, projects, volunteering, part-time work and skills, so their first CV still looks full and confident.
- Dig for specifics the way a good recruiter would: how many, how much, how often, what changed because of them. If they don't know a number, accept that and move on.
- Visitors can skip anything. If they say skip, or don't know, move on without pressure.
- If they ask you to change something in the CV, do it and confirm in one short sentence.
- Reply in the language the visitor writes in, and write the CV in that language unless they ask otherwise.
When the visitor asks a question:
- They can ask you anything, at any point: about CVs and job hunting (how long a CV should be, whether to add a photo, how to explain a gap, interview tips), about how Inkline works, or about anything else at all, such as general knowledge, everyday advice, maths, writing help or explaining something. Answer it helpfully and accurately in `reply`, like a knowledgeable friend: short for simple questions, longer (up to about 250 words) when the question needs it.
- When a message is not about the CV, keep `cv` exactly as it was. After answering, if the CV is not finished yet, add one short line inviting them to carry on, for example by asking the next CV question.
- Facts about Inkline you can share: it is free, with no card and no watermark. The Design button above the CV shows all 11 designs. Any text can be changed by clicking it on the CV, or in the "Fill in myself" form. Download PDF is above the CV. Fonts and text size can be changed with the Fonts & size button. An uploaded photo stays in their browser and is never sent to you.

When they upload an old CV:
- A visitor message may contain the details found in their old CV. Treat it as the starting draft: keep what is still true, tidy the wording, and ask what has changed since then (new jobs, new skills, a new target job), plus anything important that is missing.

Showing designs:
- When the CV first has a target job, contact details and at least one job or qualification, and again whenever the visitor asks to see designs, set `show_designs` to true and pick three or four `suggested_templates` that suit the person. Photo designs (atlas, vertex, sage, bloom, noir, horizon) suit people who will email or hand in their CV, creative and customer-facing work, and places where photos are expected. Classic designs (indigo, harbor, folio, meridian, ledger) suit corporate roles and online application forms. Mix both kinds when unsure. In `reply`, invite them to pick the one they like and say they can still change it or edit any text.
- At all other times set `show_designs` to false and `suggested_templates` to an empty list.

{$writingRules}
- `cv` is always the complete current draft: carry over everything gathered so far and add what the latest message gives you.

The other fields:
- `reply`: your next message. Keep interview messages under 90 words; answers to their questions can be longer when needed. Plain text only, no markdown. Line breaks are fine.
- `quick_replies`: up to four short tap-to-answer options when they help, such as "Add another job", "That's all", "Skip", "Show me designs". Use an empty list when a typed answer is needed.
- `stage`: the part of the interview you are in.
- When everything is covered, set `stage` to "review", tell them their CV is ready to download, and invite any changes. Use "done" only after they say they are happy.

A visitor message may start with a note that they edited the CV directly, followed by the edited CV. Treat that edited CV as the truth from then on.
PROMPT;

    $schema = $obj([
        'reply' => $str,
        'quick_replies' => $strList,
        'stage' => ['type' => 'string', 'enum' => ['basics', 'target', 'contact', 'experience', 'education', 'skills', 'extras', 'review', 'done']],
        'show_designs' => ['type' => 'boolean'],
        'suggested_templates' => ['type' => 'array', 'items' => ['type' => 'string', 'enum' => $TEMPLATES]],
        'cv' => $cvSchema,
    ]);
    $requestMessages = array_values($messages);
} else {
    // ---------- reading an old CV ----------
    $files = $in['files'] ?? (isset($in['file']) ? [$in['file']] : []);
    $text = $in['text'] ?? null;
    $content = [];
    if (is_array($files) && count($files) > 0) {
        if (count($files) > 6) reply(400, ['ok' => false, 'error' => 'too_many_files']);
        $total = 0;
        $images = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        foreach ($files as $file) {
            $type = (string)($file['media_type'] ?? '');
            $data = (string)($file['data'] ?? '');
            if ($type !== 'application/pdf' && !in_array($type, $images, true)) reply(400, ['ok' => false, 'error' => 'file_type']);
            if ($data === '' || !preg_match('/^[A-Za-z0-9+\/=\r\n]+$/', $data)) reply(400, ['ok' => false, 'error' => 'file_data']);
            $total += strlen($data);
            if ($total > 11000000) reply(400, ['ok' => false, 'error' => 'file_size']);
            $source = ['type' => 'base64', 'media_type' => $type, 'data' => $data];
            $content[] = $type === 'application/pdf' ? ['type' => 'document', 'source' => $source] : ['type' => 'image', 'source' => $source];
        }
        if (is_string($text) && trim($text) !== '' && mb_strlen($text) <= 80000) $content[] = ['type' => 'text', 'text' => "<extra_text>\n" . $text . "\n</extra_text>"];
    } elseif (is_string($text) && trim($text) !== '' && mb_strlen($text) <= 80000) {
        $content[] = ['type' => 'text', 'text' => "<old_cv>\n" . $text . "\n</old_cv>"];
    } else {
        reply(400, ['ok' => false, 'error' => 'no_file']);
    }
    $content[] = ['type' => 'text', 'text' => 'This is my old CV. Please read it and fill in my new CV from it.'];

    $system = <<<PROMPT
You are inside Inkline, a free CV maker. A visitor has uploaded their old CV: a PDF, one or more photos or scans of its pages, or text taken from a Word, Pages or other document (that text may be a little messy). Read it and turn it into Inkline's CV format, so they can update it into a new CV.

- Capture every fact faithfully: name, the job title they are going for (use their most recent job title if no target is stated), contact details, every job with dates and what they did, education, skills, languages, and any other sections.
- Rewrite weak bullets into strong, honest lines, but keep every fact as written. Do not add anything that is not in the old CV.
- If part of the document is unreadable or it is not a CV at all, extract what you can and say so plainly in `reply`.
- Write the CV in the same language as the old CV.

{$writingRules}

The other fields:
- `reply`: a short, warm message (under 70 words, plain text, no markdown) saying what you found, then one question about what has changed since this CV was written, such as a new job, new skills, or the job they want now.
- `quick_replies`: up to four short options, such as "I have a new job", "Nothing has changed", "I want a different job".
PROMPT;

    $schema = $obj([
        'reply' => $str,
        'quick_replies' => $strList,
        'cv' => $cvSchema,
    ]);
    $requestMessages = [['role' => 'user', 'content' => $content]];
}

// ---------- build the request for this model ----------
$isHaiku = strpos($model, 'claude-haiku') === 0;
$body = [
    'model' => $model,
    'max_tokens' => 12000,
    'system' => [['type' => 'text', 'text' => $system, 'cache_control' => ['type' => 'ephemeral']]],
    'messages' => $requestMessages,
    'cache_control' => ['type' => 'ephemeral'],
    'output_config' => ['format' => ['type' => 'json_schema', 'schema' => $schema]],
];
$headers = [
    'Content-Type: application/json',
    'x-api-key: ' . $apiKey,
    'anthropic-version: 2023-06-01',
];
if (!$isHaiku) {
    // A chat turn or a CV read is light work: low effort keeps it quick and cheap.
    $body['output_config']['effort'] = 'low';
    // If a safety check ever misreads an innocent CV, Anthropic retries on a suitable model.
    $body['fallbacks'] = 'default';
    $headers[] = 'anthropic-beta: server-side-fallback-2026-07-01';
}

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 120,
]);
$resp = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($resp === false) reply(502, ['ok' => false, 'error' => 'unreachable']);
$data = json_decode($resp, true);
if ($status !== 200 || !is_array($data)) {
    $type = $data['error']['type'] ?? 'api_error';
    error_log('Inkline AI error ' . $status . ': ' . substr($resp, 0, 500));
    reply($status === 429 || $status === 529 ? 429 : 502, ['ok' => false, 'error' => $type]);
}

$stop = $data['stop_reason'] ?? '';
if ($stop === 'refusal') reply(200, ['ok' => false, 'error' => 'refusal']);
if ($stop === 'max_tokens') reply(200, ['ok' => false, 'error' => 'too_long']);

$out = '';
foreach ($data['content'] ?? [] as $block) {
    if (($block['type'] ?? '') === 'text') $out .= $block['text'];
}
$parsed = json_decode($out, true);
if (!is_array($parsed) || !isset($parsed['reply'], $parsed['cv'])) reply(200, ['ok' => false, 'error' => 'format']);

// For the chat, the page stores `content` exactly as returned and sends it back next turn,
// so the history stays unchanged. A CV read is a one-off, so it only needs the result.
reply(200, $action === 'chat'
    ? ['ok' => true, 'content' => $data['content'], 'data' => $parsed]
    : ['ok' => true, 'data' => $parsed]);
