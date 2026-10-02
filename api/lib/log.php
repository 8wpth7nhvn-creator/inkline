<?php
// Security log: one JSON line per event in the data folder (never in the website folder).
// What is logged: what happened, a short anonymous visitor tag, sizes, timings and token counts.
// What is never logged: CV contents, messages, file contents, raw IP addresses, API keys.
declare(strict_types=1);
if (!defined('INKLINE')) { http_response_code(404); exit; }

function scrub_secrets(string $s): string {
    // Defence in depth: anything shaped like a key or bearer token is masked before it is written.
    $s = preg_replace('/\b(sk|rk|pk)-[A-Za-z0-9_\-]{8,}/', '$1-[redacted]', $s);
    $s = preg_replace('/Bearer\s+[A-Za-z0-9._\-]+/i', 'Bearer [redacted]', $s);
    $s = preg_replace('/x-api-key[^,}]*/i', 'x-api-key [redacted]', $s);
    $key = settings()['key'] ?? '';
    if ($key !== '') $s = str_replace($key, '[redacted]', $s);
    return $s;
}

function log_event(string $event, array $fields = []): void {
    if (!settings()['logging']) return;
    $allowed = ['action', 'reason', 'kind', 'provider', 'model', 'status', 'http_status', 'error_type', 'latency_ms',
        'input_tokens', 'output_tokens', 'files', 'media_type', 'size_kb', 'chars', 'turn', 'retry_after', 'type', 'where', 'limit'];
    $line = ['ts' => gmdate('c'), 'event' => $event, 'client' => substr($GLOBALS['INKLINE_CLIENT'] ?? '-', 0, 14)];
    foreach ($fields as $k => $v) {
        if (!in_array($k, $allowed, true)) continue;   // only known, non-sensitive fields get through
        $line[$k] = is_scalar($v) ? (is_string($v) ? substr($v, 0, 120) : $v) : null;
    }
    $json = scrub_secrets(json_encode($line, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    @file_put_contents(data_dir('logs') . '/ai-' . gmdate('Y-m-d') . '.log', $json . "\n", FILE_APPEND | LOCK_EX);
}
