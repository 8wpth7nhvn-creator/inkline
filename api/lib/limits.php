<?php
// Who is asking, and are they allowed to ask right now?
// All limits live here and are enforced on the server; the browser's own checks are only for convenience.
declare(strict_types=1);
if (!defined('INKLINE')) { http_response_code(404); exit; }

// ---------- identity ----------
// Today visitors are anonymous, so limits follow their IP address (hashed, never stored raw).
// When accounts are added, make current_user_id() return the signed-in user's id and every
// limit below automatically becomes per account instead of per IP.
function current_user_id(): ?string {
    return null;
}

function client_ip(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    if (settings()['trust_proxy']) {
        // Only trust these headers when the site sits behind a proxy you control (for example Cloudflare).
        $fwd = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? (explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0] ?? '');
        $fwd = trim($fwd);
        if (filter_var($fwd, FILTER_VALIDATE_IP)) $ip = $fwd;
    }
    // One home connection on IPv6 can own billions of addresses, so group by its /64 network.
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        $bin = inet_pton($ip);
        if ($bin !== false) $ip = bin2hex(substr($bin, 0, 8)) . '::/64';
    }
    return $ip;
}

function client_id(): string {
    $uid = current_user_id();
    if ($uid !== null) return 'user-' . substr(hash_hmac('sha256', $uid, app_secret()), 0, 24);
    return 'ip-' . substr(hash_hmac('sha256', client_ip(), app_secret()), 0, 24);
}

// ---------- the request must come from this site's own page, the normal way ----------
function check_request_shape(): void {
    $s = settings();
    $host = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
    $allowed = array_map('strtolower', $s['allowed_origins']);
    $originOk = function (string $url) use ($host, $allowed): bool {
        $h = strtolower((string)parse_url($url, PHP_URL_HOST));
        if ($h === '') return false;
        if ($h === $host) return true;
        foreach ($allowed as $a) if ($h === strtolower((string)(parse_url($a, PHP_URL_HOST) ?: $a))) return true;
        return false;
    };
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    if ($origin !== '' ? !$originOk($origin) : ($referer === '' || !$originOk($referer))) {
        log_event('request_rejected', ['reason' => 'origin']);
        fail(403, 'forbidden', 'This request is not allowed.');
    }
    // A custom header: browsers on other sites can't send it without permission, and simple scripts don't.
    if (($_SERVER['HTTP_X_INKLINE_CLIENT'] ?? '') !== '1') {
        log_event('request_rejected', ['reason' => 'client_header']);
        fail(403, 'forbidden', 'This request is not allowed.');
    }
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        log_event('request_rejected', ['reason' => 'content_type']);
        fail(415, 'unsupported_media_type', 'Requests must be sent as JSON.');
    }
    if (trim($_SERVER['HTTP_USER_AGENT'] ?? '') === '') {
        log_event('request_rejected', ['reason' => 'no_user_agent']);
        fail(403, 'forbidden', 'This request is not allowed.');
    }
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > $s['max_body_bytes']) {
        log_event('upload_rejected', ['reason' => 'body_too_large', 'size_kb' => intdiv($len, 1024)]);
        fail(413, 'too_large', 'That is too much to send at once. Files can be up to ' . intdiv($s['upload_total_bytes'], 1048576) . ' MB in total.');
    }
}

// ---------- speed limits and automated-abuse detection ----------
// Checks, in order: a temporary block, requests too close together, bursts, per minute, per hour,
// and the same request repeated within seconds. Fast repeat offenders earn strikes, then a block.
function enforce_rate_limits(string $fingerprint): void {
    $s = settings();
    $file = data_dir('rl') . '/' . $GLOBALS['INKLINE_CLIENT'] . '.json';
    $verdict = with_json_file($file, function (array $d) use ($s, $fingerprint) {
        $now = microtime(true);
        $hits = array_values(array_filter($d['hits'] ?? [], fn($t) => is_numeric($t) && $t > $now - 3600));
        $strikes = array_values(array_filter($d['strikes'] ?? [], fn($t) => is_numeric($t) && $t > $now - 600));
        $recent = array_values(array_filter($d['recent'] ?? [], fn($r) => is_array($r) && ($r[1] ?? 0) > $now - 4));
        $blockedUntil = (float)($d['blocked_until'] ?? 0);
        $save = function (?array $deny) use (&$hits, &$strikes, &$recent, &$blockedUntil) {
            return ['__save' => ['hits' => $hits, 'strikes' => $strikes, 'recent' => $recent, 'blocked_until' => $blockedUntil], '__return' => $deny];
        };
        if ($blockedUntil > $now) return $save(['blocked', (int)ceil($blockedUntil - $now)]);

        $strike = function (string $why, int $retry) use (&$strikes, &$blockedUntil, $now, $s, $save) {
            $strikes[] = $now;
            if (count($strikes) >= $s['strikes_to_block']) {
                $blockedUntil = $now + $s['block_minutes'] * 60;
                $strikes = [];
                return $save(['blocked', $s['block_minutes'] * 60]);
            }
            return $save([$why, $retry]);
        };
        $last = $hits ? max($hits) : 0;
        if ($last && ($now - $last) * 1000 < $s['min_interval_ms']) return $strike('too_fast', 2);
        $inBurst = count(array_filter($hits, fn($t) => $t > $now - $s['burst_window']));
        if ($inBurst >= $s['burst_limit']) return $strike('too_fast', $s['burst_window']);
        // The exact same request again within seconds: a double tap or a script. Pause it, no strike.
        foreach ($recent as $r) if (($r[0] ?? '') === $fingerprint) return $save(['duplicate', 4]);
        if (count(array_filter($hits, fn($t) => $t > $now - 60)) >= $s['per_minute']) return $save(['per_minute', 60]);
        if (count($hits) >= $s['per_hour']) return $save(['per_hour', 3600 - (int)($now - min($hits))]);

        $hits[] = $now;
        $recent[] = [$fingerprint, $now];
        return $save(null);
    });
    if ($verdict === null) return;
    [$why, $retry] = $verdict;
    $retry = max(1, (int)$retry);
    log_event($why === 'blocked' ? 'blocked' : 'rate_limited', ['reason' => $why, 'retry_after' => $retry]);
    $messages = [
        'blocked'    => 'Too many requests in a short time, so the AI is paused for you for a little while. Please try again later.',
        'too_fast'   => 'Slow down a little. Please wait a moment before sending again.',
        'duplicate'  => 'That was just sent. Please wait a moment.',
        'per_minute' => "You're sending messages very quickly. Please wait a minute and try again.",
        'per_hour'   => "You've used the AI a lot this hour. Please try again a bit later.",
    ];
    fail(429, 'rate_limited', $messages[$why] ?? 'Please slow down.', ['reason' => $why, 'retry_after' => $retry], ['Retry-After' => (string)$retry]);
}

// ---------- daily limits ----------
// Per visitor: AI requests, new CVs (each new conversation or upload counts as one CV), and uploads.
// For the whole site: a ceiling on AI requests per day, so costs can never run away.
// $aiCall: this request will call the AI (opening a chat does not).
function enforce_daily_limits(bool $aiCall, bool $newCv, bool $upload): void {
    $s = settings();
    $day = gmdate('Y-m-d');
    $dir = data_dir('daily/' . $day);
    $resetsIn = 86400 - (time() % 86400);

    $global = with_json_file($dir . '/_site.json', function (array $d) use ($s, $aiCall) {
        $n = (int)($d['requests'] ?? 0);
        if ($n >= $s['global_daily']) return false;
        if (!$aiCall) return true;
        return ['__save' => ['requests' => $n + 1], '__return' => true];
    });
    if (!$global) {
        log_event('daily_limit', ['kind' => 'site', 'limit' => $s['global_daily']]);
        fail(429, 'daily_limit', 'The AI has reached its limit for today. Please try again tomorrow. You can still fill in a template yourself.', ['kind' => 'site', 'retry_after' => $resetsIn], ['Retry-After' => (string)$resetsIn]);
    }

    $denied = with_json_file($dir . '/' . $GLOBALS['INKLINE_CLIENT'] . '.json', function (array $d) use ($s, $aiCall, $newCv, $upload) {
        $req = (int)($d['requests'] ?? 0); $cvs = (int)($d['cvs'] ?? 0); $ups = (int)($d['uploads'] ?? 0);
        if ($aiCall && $req >= $s['daily_requests']) return 'requests';
        if ($newCv && $cvs >= $s['daily_cvs']) return 'cvs';
        if ($upload && $ups >= $s['daily_uploads']) return 'uploads';
        return ['__save' => ['requests' => $req + ($aiCall ? 1 : 0), 'cvs' => $cvs + ($newCv ? 1 : 0), 'uploads' => $ups + ($upload ? 1 : 0)], '__return' => null];
    });
    if ($denied === null) return;
    $limit = ['requests' => $s['daily_requests'], 'cvs' => $s['daily_cvs'], 'uploads' => $s['daily_uploads']][$denied];
    log_event('daily_limit', ['kind' => $denied, 'limit' => $limit]);
    $messages = [
        'requests' => "You've reached today's limit for the AI. It resets tomorrow. You can still fill in a template yourself.",
        'cvs'      => "You've made $limit AI CVs today, which is the daily limit. It resets tomorrow. You can still fill in a template yourself.",
        'uploads'  => "You've uploaded $limit files today, which is the daily limit. It resets tomorrow.",
    ];
    fail(429, 'daily_limit', $messages[$denied], ['kind' => $denied, 'limit' => $limit, 'retry_after' => $resetsIn], ['Retry-After' => (string)$resetsIn]);
}
