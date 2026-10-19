<?php
// Copies the gallery from Google Drive onto the server, so the gallery page
// never has to talk to Google. A cPanel cron job runs it every 15 minutes:
//
//     php -q /home/<cpanel user>/public_html/gallery-sync.php
//
// The Drive folder holds one subfolder per album. Each photo is saved twice,
// as a 600 px thumbnail and a 1600 px copy, both re-saved as JPEG so the
// originals (and their location data) never leave Drive. Photos and albums
// removed from Drive are removed here too.
//
// The folder is private: the site reads it as a Google service account that
// has view access. Its key file, and everything this script writes, live in
// the cPanel home folder, above public_html, so none of it can be opened from
// the web. The gallery page reads albums.json, and gallery-photo.php serves
// the photos.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

// The ID isn't secret: without the key file it gives no access to the folder
const DRIVE_FOLDER_ID = '1cSdOLhzAycWS7WO_N7O35rEFyf-lxyL3';

const THUMB_SIZE = 600;
const FULL_SIZE = 1600;
const JPEG_QUALITY = 82;

// The cPanel home folder is the one above public_html. GALLERY_HOME and
// GALLERY_DRIVE_API exist so the script can be tried locally against a fake.
$home = getenv('GALLERY_HOME') ?: dirname(__DIR__);
$keyFile = "$home/pirates-website-gallery-google-drive-gcp-key.json";
$dataDir = "$home/pirates-website-gallery";
$photoDir = "$dataDir/photos";
$driveApi = getenv('GALLERY_DRIVE_API') ?: 'https://www.googleapis.com/drive/v3';

// A 12-megapixel photo needs about 50 MB to resize
ini_set('memory_limit', '512M');
set_time_limit(0);

function say($message) {
    echo date('Y-m-d H:i:s') . " $message\n";
}

function fail($message) {
    fwrite(STDERR, date('Y-m-d H:i:s') . " Sync stopped: $message\n");
    exit(1);
}

function base64url($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function http_request($url, $options = []) {
    $curl = curl_init($url);
    curl_setopt_array($curl, $options + [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 20,
        CURLOPT_TIMEOUT => 120,
    ]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    if ($body === false) {
        throw new RuntimeException("couldn't reach $url ($error)");
    }
    return [$status, $body];
}

// Signs in as the service account: a token signed with its private key is
// swapped for an access token that can read Drive (and nothing else)
function access_token($key) {
    $now = time();
    $header = base64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claims = base64url(json_encode([
        'iss' => $key['client_email'],
        'scope' => 'https://www.googleapis.com/auth/drive.readonly',
        'aud' => $key['token_uri'],
        'iat' => $now,
        'exp' => $now + 3600,
    ]));
    if (!openssl_sign("$header.$claims", $signature, $key['private_key'], OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException("couldn't sign in with the key file");
    }
    [$status, $body] = http_request($key['token_uri'], [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => "$header.$claims." . base64url($signature),
        ]),
    ]);
    $response = json_decode($body, true);
    if ($status !== 200 || empty($response['access_token'])) {
        throw new RuntimeException("Google refused the sign-in ($status): $body");
    }
    return $response['access_token'];
}

function drive_get($url, $token) {
    [$status, $body] = http_request($url, [CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"]]);
    if ($status !== 200) {
        throw new RuntimeException("Drive answered $status for $url: " . substr($body, 0, 500));
    }
    return $body;
}

// Lists a folder's contents, following Drive's pages of results
function drive_list($api, $token, $query, $fields) {
    $files = [];
    $pageToken = null;
    do {
        $params = [
            'q' => $query,
            'fields' => "nextPageToken, files($fields)",
            'orderBy' => 'name_natural',
            'pageSize' => 1000,
            'supportsAllDrives' => 'true',
            'includeItemsFromAllDrives' => 'true',
        ];
        if ($pageToken) {
            $params['pageToken'] = $pageToken;
        }
        $page = json_decode(drive_get("$api/files?" . http_build_query($params), $token), true);
        $files = array_merge($files, $page['files'] ?? []);
        $pageToken = $page['nextPageToken'] ?? null;
    } while ($pageToken);
    return $files;
}

// Phone cameras store photos sideways and record which way is up in EXIF;
// re-saving drops EXIF, so the turn has to be applied to the pixels first
function upright($image, $file) {
    $exif = function_exists('exif_read_data') ? @exif_read_data($file) : false;
    switch ($exif['Orientation'] ?? 1) {
        case 2: imageflip($image, IMG_FLIP_HORIZONTAL); break;
        case 3: $image = imagerotate($image, 180, 0); break;
        case 4: imageflip($image, IMG_FLIP_VERTICAL); break;
        case 5: $image = imagerotate($image, -90, 0); imageflip($image, IMG_FLIP_HORIZONTAL); break;
        case 6: $image = imagerotate($image, -90, 0); break;
        case 7: $image = imagerotate($image, 90, 0); imageflip($image, IMG_FLIP_HORIZONTAL); break;
        case 8: $image = imagerotate($image, 90, 0); break;
    }
    return $image;
}

// Saves a copy no larger than $size on its long edge; small photos aren't enlarged
function save_resized($image, $size, $path) {
    $width = imagesx($image);
    $height = imagesy($image);
    $scale = min(1, $size / max($width, $height));
    $newWidth = max(1, (int) round($width * $scale));
    $newHeight = max(1, (int) round($height * $scale));
    $copy = imagecreatetruecolor($newWidth, $newHeight);
    // PNGs with see-through parts get a white background, not black
    imagefill($copy, 0, 0, imagecolorallocate($copy, 255, 255, 255));
    imagecopyresampled($copy, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
    imageinterlace($copy, true);
    $saved = imagejpeg($copy, "$path.tmp", JPEG_QUALITY) && rename("$path.tmp", $path);
    imagedestroy($copy);
    if (!$saved) {
        throw new RuntimeException("couldn't save $path");
    }
    return [$newWidth, $newHeight];
}

// Downloads one photo from Drive and saves its two copies. Returns false for
// a file PHP can't read (such as an iPhone HEIC photo) and Drive can't preview.
function make_copies($api, $token, $file, $name, $photoDir) {
    $download = tempnam(sys_get_temp_dir(), 'gallery');
    try {
        file_put_contents($download, drive_get("$api/files/{$file['id']}?alt=media&supportsAllDrives=true", $token));
        $image = @imagecreatefromstring(file_get_contents($download));
        if ($image) {
            $image = upright($image, $download);
        } elseif (!empty($file['thumbnailLink'])) {
            // Drive makes a JPEG preview of formats PHP can't read; ask for it at full size
            $preview = preg_replace('/=s\d+$/', '=s' . FULL_SIZE, $file['thumbnailLink']);
            $image = @imagecreatefromstring(drive_get($preview, $token));
        }
        if (!$image) {
            return false;
        }
        save_resized($image, THUMB_SIZE, "$photoDir/$name-t.jpg");
        [$width, $height] = save_resized($image, FULL_SIZE, "$photoDir/$name.jpg");
        imagedestroy($image);
        return [$width, $height];
    } finally {
        @unlink($download);
    }
}

function slug($text) {
    $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($text)), '-');
    return $slug === '' ? 'album' : $slug;
}

function write_json($path, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (file_put_contents("$path.tmp", $json) === false || !rename("$path.tmp", $path)) {
        throw new RuntimeException("couldn't save $path");
    }
}

$key = json_decode(@file_get_contents($keyFile), true);
if (empty($key['client_email']) || empty($key['private_key']) || empty($key['token_uri'])) {
    fail("the key file $keyFile is missing or isn't a service account key");
}

if (!is_dir($photoDir) && !mkdir($photoDir, 0755, true)) {
    fail("couldn't create $photoDir");
}

// A slow run must not overlap the next one
$lock = fopen("$dataDir/sync.lock", 'c');
if (!flock($lock, LOCK_EX | LOCK_NB)) {
    say('An earlier sync is still running; skipping this one.');
    exit;
}

// What was copied on earlier runs: Drive file ID => the copies' name and the
// Drive version they were made from
$statePath = "$dataDir/state.json";
$state = json_decode(@file_get_contents($statePath), true) ?: [];

try {
    $token = access_token($key);
    $folders = drive_list(
        $driveApi,
        $token,
        "'" . DRIVE_FOLDER_ID . "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        'id, name'
    );

    $albums = [];
    $newState = [];
    $added = 0;
    $slugs = [];

    foreach ($folders as $folder) {
        $folderName = trim($folder['name']);
        // Albums still being prepared start with _
        if ($folderName === '' || $folderName[0] === '_') {
            continue;
        }

        $files = drive_list(
            $driveApi,
            $token,
            "'{$folder['id']}' in parents and mimeType contains 'image/' and trashed = false",
            'id, name, md5Checksum, modifiedTime, description, thumbnailLink'
        );

        $photos = [];
        $cover = null;
        foreach ($files as $file) {
            $version = $file['md5Checksum'] ?? $file['modifiedTime'] ?? '';
            $known = $state[$file['id']] ?? null;
            if ($known && $known['version'] === $version && !empty($known['unreadable'])) {
                // Already reported; try again only once the file changes
                $newState[$file['id']] = $known;
                continue;
            }
            if ($known && $known['version'] === $version && is_file("$photoDir/{$known['name']}.jpg")) {
                $copy = $known;
            } else {
                // A new name for every version, so browsers never show an old copy
                $name = bin2hex(random_bytes(12));
                $size = make_copies($driveApi, $token, $file, $name, $photoDir);
                if (!$size) {
                    $newState[$file['id']] = ['version' => $version, 'unreadable' => true];
                    say("Skipped \"{$file['name']}\" in \"$folderName\": it isn't a photo format the site can read. JPEG and PNG work.");
                    continue;
                }
                $copy = ['name' => $name, 'version' => $version, 'width' => $size[0], 'height' => $size[1]];
                $added++;
            }
            $newState[$file['id']] = $copy;

            $photo = [
                'thumb' => "{$copy['name']}-t.jpg",
                'full' => "{$copy['name']}.jpg",
                'width' => $copy['width'],
                'height' => $copy['height'],
                'caption' => trim($file['description'] ?? ''),
            ];
            $photos[] = $photo;
            if ($cover === null && strtolower(pathinfo($file['name'], PATHINFO_FILENAME)) === 'cover') {
                $cover = $photo;
            }
        }
        if (!$photos) {
            continue;
        }

        // "2026-10-04 Open Day" is dated; anything else is just a title
        $title = $folderName;
        $date = null;
        if (preg_match('/^(\d{4}-\d{2}-\d{2})\s+(.+)$/', $folderName, $match) && strtotime($match[1])) {
            [, $date, $title] = $match;
        }

        $slug = slug($folderName);
        if (isset($slugs[$slug])) {
            $slug .= '-' . (++$slugs[$slug]);
        } else {
            $slugs[$slug] = 1;
        }

        $albums[] = [
            'slug' => $slug,
            'title' => $title,
            'date' => $date,
            'cover' => ($cover ?? $photos[0])['thumb'],
            'photos' => $photos,
        ];
    }
} catch (RuntimeException $error) {
    // Leave the gallery as it was rather than emptying it while Drive is unreachable
    fail($error->getMessage());
}

// Newest dated albums first, then undated ones by name
usort($albums, function ($a, $b) {
    if ($a['date'] !== $b['date']) {
        if ($a['date'] === null) return 1;
        if ($b['date'] === null) return -1;
        return strcmp($b['date'], $a['date']);
    }
    return strnatcasecmp($a['title'], $b['title']);
});

try {
    write_json("$dataDir/albums.json", $albums);
    write_json($statePath, $newState);
} catch (RuntimeException $error) {
    fail($error->getMessage());
}

// Only once the new list is saved: remove copies of photos that left Drive
$keep = [];
foreach (array_filter($newState, fn($copy) => isset($copy['name'])) as $copy) {
    $keep["{$copy['name']}.jpg"] = true;
    $keep["{$copy['name']}-t.jpg"] = true;
}
$removed = 0;
foreach (glob("$photoDir/*.jpg") as $path) {
    if (!isset($keep[basename($path)])) {
        unlink($path);
        $removed++;
    }
}

$photoCount = array_sum(array_map(fn($album) => count($album['photos']), $albums));
if ($added || $removed) {
    say(count($albums) . " albums, $photoCount photos: $added added or changed, " . intdiv($removed, 2) . ' removed.');
}
