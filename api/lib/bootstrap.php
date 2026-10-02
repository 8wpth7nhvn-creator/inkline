<?php
// Shared setup for the AI endpoint: safe errors, settings from environment variables, and storage.
// Nothing in this folder can be opened from a browser (see api/.htaccess and dev-router.php).
declare(strict_types=1);
if (!defined('INKLINE')) { http_response_code(404); exit; }

// ---------- never show internal errors to visitors ----------
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

function json_out(int $status, array $body, array $headers = []): void {
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: no-referrer');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
        foreach ($headers as $k => $v) header($k . ': ' . $v);
    }
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// A clear, safe error for visitors: a short code and a plain message, nothing internal.
function fail(int $status, string $code, string $message, array $extra = [], array $headers = []): void {
    json_out($status, array_merge(['ok' => false, 'error' => $code, 'message' => $message], $extra), $headers);
}

set_error_handler(function (int $no, string $str, string $file, int $line): bool {
    if (!(error_reporting() & $no)) return false;
    // A newer PHP marking something as outdated must never break the site: note it and carry on.
    if ($no === E_DEPRECATED || $no === E_USER_DEPRECATED) { error_log('Inkline AI deprecation: ' . basename($file) . ':' . $line); return true; }
    throw new ErrorException($str, 0, $no, $file, $line);
});
set_exception_handler(function (Throwable $e): void {
    // The server log gets the type and place, never request contents or settings.
    if (function_exists('log_event')) log_event('server_error', ['type' => get_class($e), 'where' => basename($e->getFile()) . ':' . $e->getLine()]);
    error_log('Inkline AI: ' . get_class($e) . ' at ' . basename($e->getFile()) . ':' . $e->getLine());
    fail(500, 'server_error', 'Something went wrong on our side. Please try again in a moment.');
});

// ---------- settings: real environment variables first, then a .env file ----------
// Recommended: put .env one folder ABOVE the website folder (for example above public_html),
// where no browser can reach it. A .env inside the website folder also works and is blocked by .htaccess.
function load_env_file(string $path): void {
    if (!is_file($path) || !is_readable($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
        [$k, $v] = array_map('trim', explode('=', $line, 2));
        if (!preg_match('/^[A-Z][A-Z0-9_]*$/', $k)) continue;
        if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && substr($v, -1) === $v[0]) $v = substr($v, 1, -1);
        if (getenv($k) === false && !isset($_SERVER[$k])) { putenv("$k=$v"); $_ENV[$k] = $v; }
    }
}
define('SITE_ROOT', dirname(__DIR__, 2));
load_env_file(dirname(SITE_ROOT) . '/.env');
load_env_file(SITE_ROOT . '/.env');

function env(string $key, ?string $default = null): ?string {
    $v = getenv($key);
    if ($v === false) $v = $_SERVER[$key] ?? $_ENV[$key] ?? null;   // SetEnv in .htaccess lands in $_SERVER
    if ($v === null || $v === '') return $default;
    return (string)$v;
}
function env_int(string $key, int $default, int $min = 0, int $max = PHP_INT_MAX): int {
    $v = env($key);
    if ($v === null || !preg_match('/^-?\d+$/', $v)) return $default;
    return max($min, min($max, (int)$v));
}
function env_bool(string $key, bool $default): bool {
    $v = env($key);
    if ($v === null) return $default;
    return in_array(strtolower($v), ['1', 'true', 'yes', 'on'], true);
}

// Every limit can be changed in the environment without touching code.
function settings(): array {
    static $s = null;
    if ($s !== null) return $s;
    $openaiKey = env('OPENAI_API_KEY', '');
    $anthropicKey = env('ANTHROPIC_API_KEY', '');
    $provider = strtolower(env('AI_PROVIDER', 'auto'));
    if ($provider === 'auto') $provider = $openaiKey !== '' ? 'openai' : ($anthropicKey !== '' ? 'anthropic' : 'openai');
    if (!in_array($provider, ['openai', 'anthropic'], true)) $provider = 'openai';
    $mb = 1024 * 1024;
    $s = [
        'provider'             => $provider,
        'key'                  => $provider === 'openai' ? $openaiKey : $anthropicKey,
        'model'                => $provider === 'openai' ? env('OPENAI_MODEL', 'gpt-5.4-mini') : env('ANTHROPIC_MODEL', 'claude-opus-5-5'),
        'base_url'             => rtrim($provider === 'openai' ? env('OPENAI_BASE_URL', 'https://api.openai.com/v1') : env('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'), '/'),
        'reasoning_effort'     => env('OPENAI_REASONING_EFFORT', 'low'),
        'max_output_tokens'    => env_int('AI_MAX_OUTPUT_TOKENS', 8000, 1000, 64000),
        'timeout'              => env_int('AI_TIMEOUT_SECONDS', 90, 10, 300),
        // speed limits
        'min_interval_ms'      => env_int('AI_MIN_MS_BETWEEN_REQUESTS', 1200, 0, 60000),
        'burst_limit'          => env_int('AI_BURST_LIMIT', 4, 1, 100),
        'burst_window'         => env_int('AI_BURST_WINDOW_SECONDS', 10, 1, 300),
        'per_minute'           => env_int('AI_RATE_LIMIT_PER_MINUTE', 12, 1, 1000),
        'per_hour'             => env_int('AI_RATE_LIMIT_PER_HOUR', 80, 1, 10000),
        'strikes_to_block'     => env_int('AI_STRIKES_BEFORE_BLOCK', 3, 1, 100),
        'block_minutes'        => env_int('AI_BLOCK_MINUTES', 15, 1, 1440),
        // daily limits (per visitor, and for the whole site)
        'daily_cvs'            => env_int('AI_DAILY_CV_LIMIT', 5, 1, 1000),
        'daily_requests'       => env_int('AI_DAILY_REQUEST_LIMIT', 150, 1, 100000),
        'daily_uploads'        => env_int('AI_DAILY_UPLOAD_LIMIT', 10, 0, 1000),
        'global_daily'         => env_int('AI_GLOBAL_DAILY_REQUEST_LIMIT', 3000, 1, 10000000),
        'max_turns'            => env_int('AI_MAX_TURNS_PER_CV', 60, 5, 500),
        // privacy: chats are deleted from the server after this many hours
        'retention_hours'      => env_int('CONVERSATION_RETENTION_HOURS', 24, 1, 168),
        // request size limits
        'max_message_chars'    => env_int('AI_MAX_MESSAGE_CHARS', 4000, 100, 50000),
        'max_import_chars'     => env_int('AI_MAX_IMPORT_TEXT_CHARS', 40000, 1000, 200000),
        'max_history_chars'    => env_int('AI_MAX_HISTORY_CHARS', 120000, 20000, 1000000),
        'upload_file_bytes'    => env_int('UPLOAD_MAX_FILE_MB', 8, 1, 50) * $mb,
        'upload_total_bytes'   => env_int('UPLOAD_MAX_TOTAL_MB', 10, 1, 60) * $mb,
        'upload_files'         => env_int('UPLOAD_MAX_FILES', 6, 1, 20),
        // network and storage
        'trust_proxy'          => env_bool('TRUST_PROXY_HEADERS', false),
        'allowed_origins'      => array_values(array_filter(array_map('trim', explode(',', env('ALLOWED_ORIGINS', ''))))),
        'data_dir'             => env('INKLINE_DATA_DIR', dirname(SITE_ROOT) . '/inkline-data'),
        'logging'              => env_bool('AI_LOGGING', true),
    ];
    // The whole request body can never be bigger than the uploads plus room for base64 and JSON.
    $s['max_body_bytes'] = (int)ceil($s['upload_total_bytes'] * 1.4) + $s['max_import_chars'] * 4 + 200000;
    return $s;
}

// ---------- storage outside the website folder ----------
function data_dir(string $sub = ''): string {
    static $base = null;
    if ($base === null) {
        $want = settings()['data_dir'];
        if (!is_dir($want)) @mkdir($want, 0700, true);
        if (!is_dir($want) || !is_writable($want)) {
            $want = sys_get_temp_dir() . '/inkline-data';
            if (!is_dir($want)) @mkdir($want, 0700, true);
        }
        $base = rtrim($want, '/');
    }
    $dir = $sub === '' ? $base : $base . '/' . $sub;
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir;
}

// Read-modify-write a JSON file under an exclusive lock, so parallel requests can't slip past a limit.
function with_json_file(string $path, callable $fn) {
    $fh = fopen($path, 'c+');
    if (!$fh) throw new RuntimeException('storage unavailable');
    try {
        flock($fh, LOCK_EX);
        $raw = stream_get_contents($fh);
        $data = $raw ? json_decode($raw, true) : [];
        if (!is_array($data)) $data = [];
        // $fn returns a plain value (nothing saved) or ['__save' => new data, '__return' => value].
        $result = $fn($data);
        if (is_array($result) && array_key_exists('__save', $result)) {
            ftruncate($fh, 0); rewind($fh);
            fwrite($fh, json_encode($result['__save'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            fflush($fh);
            return $result['__return'] ?? null;
        }
        return $result;
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

// A random secret used to hash IP addresses, created once and kept with the data.
function app_secret(): string {
    $fromEnv = env('APP_SECRET');
    if ($fromEnv !== null && strlen($fromEnv) >= 16) return $fromEnv;
    $file = data_dir() . '/.secret';
    if (!is_file($file)) @file_put_contents($file, bin2hex(random_bytes(32)), LOCK_EX);
    $s = is_file($file) ? trim((string)file_get_contents($file)) : '';
    return strlen($s) >= 32 ? $s : hash('sha256', __DIR__ . php_uname());
}

// Old files are swept away now and then: counters after 3 days, chats after CONVERSATION_RETENTION_HOURS, logs after 30 days.
function maybe_cleanup(): void {
    if (random_int(1, 20) !== 1) return;   // about one request in twenty sweeps old files
    $now = time();
    foreach (glob(data_dir('daily') . '/*', GLOB_ONLYDIR) ?: [] as $d) {
        if (strtotime(basename($d)) !== false && strtotime(basename($d)) < $now - 3 * 86400) {
            array_map('unlink', glob($d . '/*') ?: []); @rmdir($d);
        }
    }
    foreach (['conv' => settings()['retention_hours'] * 3600, 'rl' => 2 * 86400] as $sub => $age) {
        foreach (glob(data_dir($sub) . '/*.json') ?: [] as $f) if (filemtime($f) < $now - $age) @unlink($f);
    }
    foreach (glob(data_dir('logs') . '/*.log') ?: [] as $f) if (filemtime($f) < $now - 30 * 86400) @unlink($f);
}
