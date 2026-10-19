<?php
// Serves the gallery's photos, which gallery-sync.php saves above public_html
// so they can't be listed or opened directly. Only names the sync job makes
// are accepted, and other websites can't show the photos on their pages.

$home = getenv('GALLERY_HOME') ?: dirname(__DIR__);
$name = $_GET['p'] ?? '';
$path = "$home/pirates-website-gallery/photos/$name";

$referer = parse_url($_SERVER['HTTP_REFERER'] ?? '', PHP_URL_HOST);
$host = parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
if ($referer && $host && strcasecmp(preg_replace('/^www\./i', '', $referer), preg_replace('/^www\./i', '', $host)) !== 0) {
    http_response_code(403);
    exit;
}

if (!preg_match('/^[0-9a-f]{24}(-t)?\.jpg$/', $name) || !is_file($path)) {
    http_response_code(404);
    exit;
}

// A changed photo gets a new name, so a copy never goes out of date
header('Content-Type: image/jpeg');
header('Content-Length: ' . filesize($path));
header('Cache-Control: public, max-age=31536000, immutable');
header('X-Robots-Tag: noindex');
readfile($path);
