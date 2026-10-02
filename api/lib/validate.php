<?php
// Everything that arrives from the browser is checked here before it can reach the AI.
declare(strict_types=1);
if (!defined('INKLINE')) { http_response_code(404); exit; }

const TEMPLATE_IDS = ['atlas', 'vertex', 'sage', 'bloom', 'noir', 'horizon', 'indigo', 'harbor', 'folio', 'meridian', 'ledger'];
const STAGES = ['basics', 'target', 'contact', 'experience', 'education', 'skills', 'extras', 'review', 'done'];

// Plain text only: valid UTF-8, no control characters, trimmed to a maximum length.
function clean_text($v, int $max): string {
    if (!is_string($v)) return '';
    if (!mb_check_encoding($v, 'UTF-8')) $v = mb_convert_encoding($v, 'UTF-8', 'UTF-8');
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

// The CV keeps only known fields, with sensible caps on every list and every line.
// This is also how CVs coming back from the AI are cleaned before they reach the page.
function normalize_cv($raw): array {
    $raw = is_array($raw) ? $raw : [];
    $t = fn($v, $n = 200) => clean_text($v, $n);
    $list = fn($v, $count, $len) => array_values(array_filter(array_map(fn($x) => clean_text($x, $len), array_slice(is_array($v) ? $v : [], 0, $count)), fn($x) => $x !== ''));
    $cv = [
        'name' => $t($raw['name'] ?? '', 120), 'title' => $t($raw['title'] ?? '', 160),
        'email' => $t($raw['email'] ?? '', 160), 'phone' => $t($raw['phone'] ?? '', 60),
        'location' => $t($raw['location'] ?? '', 120), 'link' => $t($raw['link'] ?? '', 200),
        'summary' => $t($raw['summary'] ?? '', 1500),
        'experience' => [], 'education' => [], 'skills' => [], 'languages' => [], 'extras' => [],
    ];
    foreach (array_slice(is_array($raw['experience'] ?? null) ? $raw['experience'] : [], 0, 15) as $x) {
        if (!is_array($x)) continue;
        $cv['experience'][] = ['role' => $t($x['role'] ?? ''), 'company' => $t($x['company'] ?? ''), 'location' => $t($x['location'] ?? '', 120),
            'start' => $t($x['start'] ?? '', 40), 'end' => $t($x['end'] ?? '', 40), 'bullets' => $list($x['bullets'] ?? [], 8, 400)];
    }
    foreach (array_slice(is_array($raw['education'] ?? null) ? $raw['education'] : [], 0, 10) as $x) {
        if (!is_array($x)) continue;
        $cv['education'][] = ['qualification' => $t($x['qualification'] ?? ''), 'school' => $t($x['school'] ?? ''), 'location' => $t($x['location'] ?? '', 120),
            'start' => $t($x['start'] ?? '', 40), 'end' => $t($x['end'] ?? '', 40), 'details' => $t($x['details'] ?? '', 600)];
    }
    $cv['skills'] = $list($raw['skills'] ?? [], 40, 80);
    $cv['languages'] = $list($raw['languages'] ?? [], 20, 80);
    foreach (array_slice(is_array($raw['extras'] ?? null) ? $raw['extras'] : [], 0, 8) as $g) {
        if (!is_array($g)) continue;
        $items = $list($g['items'] ?? [], 20, 300);
        if ($items) $cv['extras'][] = ['heading' => $t($g['heading'] ?? '', 80), 'items' => $items];
    }
    return $cv;
}

// What the AI returns is checked too, so a strange answer can never break or bloat the page.
function clean_ai_reply(array $d): array {
    return [
        'reply' => clean_text($d['reply'] ?? '', 3000) ?: 'Got it. What else should we add?',
        'quick_replies' => array_slice(array_values(array_filter(array_map(fn($q) => clean_text($q, 60), is_array($d['quick_replies'] ?? null) ? $d['quick_replies'] : []))), 0, 4),
        'stage' => in_array($d['stage'] ?? '', STAGES, true) ? $d['stage'] : 'basics',
        'show_designs' => !empty($d['show_designs']),
        'suggested_templates' => array_slice(array_values(array_unique(array_filter(is_array($d['suggested_templates'] ?? null) ? $d['suggested_templates'] : [], fn($id) => in_array($id, TEMPLATE_IDS, true)))), 0, 4),
        'cv' => normalize_cv($d['cv'] ?? []),
    ];
}

function valid_conversation_id($id): ?string {
    return is_string($id) && preg_match('/^[a-f0-9]{32}$/', $id) ? $id : null;
}

// ---------- uploads ----------
// Only the file types the CV maker needs. The real contents are checked, not just the name or label.
const UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function reject_upload(int $status, string $reason, string $message, array $log = []): void {
    log_event('upload_rejected', array_merge(['reason' => $reason], $log));
    fail($status, $status === 413 ? 'too_large' : ($status === 415 ? 'unsupported_file' : 'invalid_file'), $message);
}

function sniff_type(string $bytes): ?string {
    if (strncmp($bytes, '%PDF-', 5) === 0) return 'application/pdf';
    if (strncmp($bytes, "\xFF\xD8\xFF", 3) === 0) return 'image/jpeg';
    if (strncmp($bytes, "\x89PNG\r\n\x1A\n", 8) === 0) return 'image/png';
    if (strncmp($bytes, 'GIF87a', 6) === 0 || strncmp($bytes, 'GIF89a', 6) === 0) return 'image/gif';
    if (strncmp($bytes, 'RIFF', 4) === 0 && substr($bytes, 8, 4) === 'WEBP') return 'image/webp';
    return null;
}

// Returns the checked files as [['media_type' => ..., 'data' => base64]] ready for the AI.
function validate_uploads($files): array {
    $s = settings();
    if (!is_array($files) || !array_is_list($files)) reject_upload(400, 'not_a_list', 'The upload could not be read.');
    if (count($files) > $s['upload_files']) reject_upload(413, 'too_many_files', 'Please upload up to ' . $s['upload_files'] . ' files at a time.', ['files' => count($files)]);
    $total = 0; $out = [];
    foreach ($files as $f) {
        $type = is_array($f) ? (string)($f['media_type'] ?? '') : '';
        $b64 = is_array($f) ? (string)($f['data'] ?? '') : '';
        if (!in_array($type, UPLOAD_TYPES, true)) {
            reject_upload(415, 'type_not_allowed', 'That file type is not supported. Please upload a PDF, a Word or Pages document, or a photo (JPG, PNG, WebP).', ['media_type' => substr($type, 0, 60)]);
        }
        if (strlen($b64) > (int)ceil($s['upload_file_bytes'] * 4 / 3) + 16) {
            reject_upload(413, 'file_too_large', 'Each file can be up to ' . intdiv($s['upload_file_bytes'], 1048576) . ' MB.', ['media_type' => $type, 'size_kb' => intdiv(strlen($b64) * 3, 4096)]);
        }
        $bytes = base64_decode($b64, true);
        if ($bytes === false || $bytes === '') reject_upload(400, 'bad_base64', 'The upload could not be read.', ['media_type' => $type]);
        $size = strlen($bytes);
        if ($size > $s['upload_file_bytes']) reject_upload(413, 'file_too_large', 'Each file can be up to ' . intdiv($s['upload_file_bytes'], 1048576) . ' MB.', ['media_type' => $type, 'size_kb' => intdiv($size, 1024)]);
        $total += $size;
        if ($total > $s['upload_total_bytes']) reject_upload(413, 'total_too_large', 'Your files can be up to ' . intdiv($s['upload_total_bytes'], 1048576) . ' MB together.', ['size_kb' => intdiv($total, 1024)]);
        $real = sniff_type($bytes);
        if ($real !== $type) reject_upload(415, 'content_mismatch', "That file isn't what its name says it is. Please upload a real PDF or photo.", ['media_type' => $type]);
        if ($type !== 'application/pdf') {
            $info = @getimagesizefromstring($bytes);
            if (!$info || $info[0] < 50 || $info[1] < 50 || $info[0] > 12000 || $info[1] > 12000) {
                reject_upload(415, 'bad_image', "That image couldn't be read. Please try another photo.", ['media_type' => $type]);
            }
        }
        $out[] = ['media_type' => $type, 'data' => base64_encode($bytes)];   // re-encoded: no stray characters reach the AI
    }
    return $out;
}

function validate_import_text($text): string {
    $s = settings();
    if (!is_string($text)) return '';
    if (mb_strlen($text) > $s['max_import_chars'] * 1.2) {
        reject_upload(413, 'text_too_long', 'That document is too long to read. Please upload a shorter CV.', ['chars' => mb_strlen($text)]);
    }
    return clean_text($text, $s['max_import_chars']);
}
