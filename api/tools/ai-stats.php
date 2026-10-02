<?php
// Security summary from the AI log. Run on the server only:  php api/tools/ai-stats.php [YYYY-MM-DD]
// Not reachable from a browser (blocked by api/.htaccess and refused below).
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('INKLINE', true);
require __DIR__ . '/../lib/bootstrap.php';

$day = $argv[1] ?? gmdate('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) { fwrite(STDERR, "Date must look like 2026-10-02\n"); exit(1); }
$file = data_dir('logs') . '/ai-' . $day . '.log';
if (!is_file($file)) { echo "No AI activity logged on $day.\n"; exit(0); }

$events = []; $reasons = []; $clients = []; $in = 0; $out = 0;
foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $e = json_decode($line, true);
    if (!is_array($e)) continue;
    $events[$e['event']] = ($events[$e['event']] ?? 0) + 1;
    if (isset($e['reason']) || isset($e['kind'])) {
        $k = $e['event'] . ': ' . ($e['reason'] ?? $e['kind']);
        $reasons[$k] = ($reasons[$k] ?? 0) + 1;
    }
    $clients[$e['client'] ?? '-'] = true;
    $in += (int)($e['input_tokens'] ?? 0);
    $out += (int)($e['output_tokens'] ?? 0);
}
arsort($events); arsort($reasons);
echo "Inkline AI on $day\n\n";
printf("  %-28s %d\n", 'different visitors', count($clients));
foreach ($events as $k => $v) printf("  %-28s %d\n", $k, $v);
printf("  %-28s %d in / %d out\n", 'AI tokens', $in, $out);
if ($reasons) { echo "\nWhy requests were turned away:\n"; foreach ($reasons as $k => $v) printf("  %-40s %d\n", $k, $v); }
