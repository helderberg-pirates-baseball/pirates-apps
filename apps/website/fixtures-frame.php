<?php
// The fixtures page is maintained by someone outside this repo. Their file is
// kept unchanged in fixtures/schedule.html so a new version can be copied over
// it as is. fixtures.php shows it in a frame below the site's header, and this
// file serves it with our additions: a favicon, and the crest loaded from img/
// instead of a 200 KB inline copy. The crest swap is skipped if their markup
// changes, so the page always loads.

// Search engines should list fixtures.php, which has the site's menu, not this
header('X-Robots-Tag: noindex');

$page = file_get_contents(__DIR__ . '/fixtures/schedule.html');

$page = str_replace('</head>', '<link href="img/favicon.jpg" rel="icon">' . "\n</head>", $page);

$page = preg_replace(
    '/<div class="crest-mark"><img src="data:image\/[a-z]+;base64,[^"]+"/',
    '<div class="crest-mark"><img src="img/Logo.png"',
    $page,
    1
);

echo $page;
