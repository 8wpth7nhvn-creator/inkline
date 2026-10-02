<?php
// Local preview only:  php -S 127.0.0.1:8800 dev-router.php
// PHP's built-in server ignores .htaccess, so this applies the same protections while you test.
$path = rawurldecode((string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$deny = preg_match('#(^|/)\.(?!well-known/)#', $path)               // .env, .git, .htaccess ...
     || preg_match('#^/api/(?!ai\.php$)#', $path)                    // only the endpoint itself is public
     || preg_match('#^/(dev-router\.php|README\.md)$#', $path)
     || preg_match('#(^|/)inkline-data(/|$)#', $path);
if ($deny) { http_response_code(404); header('Content-Type: text/plain'); echo 'Not found'; return true; }
$file = __DIR__ . $path;
if (preg_match('/\.mjs$/', $path) && is_file($file)) { header('Content-Type: text/javascript'); readfile($file); return true; }
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
return false;   // let the built-in server serve the file (and run api/ai.php)
