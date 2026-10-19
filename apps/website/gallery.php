<?php
// The albums come from the club's Google Drive folder: gallery-sync.php copies
// them onto the server every 15 minutes and lists them in albums.json, above
// public_html. Each subfolder in Drive is an album here.
$home = getenv('GALLERY_HOME') ?: dirname(__DIR__);
$albums = json_decode(@file_get_contents("$home/pirates-website-gallery/albums.json"), true) ?: [];

$album = null;
$albumMissing = false;
if (isset($_GET['album'])) {
    foreach ($albums as $candidate) {
        if ($candidate['slug'] === $_GET['album']) {
            $album = $candidate;
        }
    }
    if (!$album) {
        $albumMissing = true;
        http_response_code(404);
    }
}

function e($text) {
    return htmlspecialchars($text ?? '', ENT_QUOTES);
}

function photo_url($name) {
    return 'gallery-photo.php?p=' . rawurlencode($name);
}

function album_date($date) {
    return date('j F Y', strtotime($date));
}
?>
<html lang="en">

<head>
    <meta charset="utf-8">
    <title><?php echo $album ? e($album['title']) . ' | ' : ''; ?>Helderberg Pirates Baseball</title>
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <meta name="description" content="Photos from Helderberg Pirates games, training sessions and open days at Radloff Park, Somerset West.">

    <!-- Favicon -->
    <link href="img/favicon.jpg" rel="icon">

    <!-- Google Web Fonts -->
    <link rel="preconnect" href="https://fonts.gstatic.com">
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Rubik&display=swap" rel="stylesheet"> 

    <!-- Icon Font Stylesheet -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.0/css/all.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.4.1/font/bootstrap-icons.css" rel="stylesheet">
    <link href="lib/flaticon/font/flaticon.css" rel="stylesheet">

    <!-- Libraries Stylesheet -->
    <link href="lib/owlcarousel/assets/owl.carousel.min.css" rel="stylesheet">

    <!-- Customized Bootstrap Stylesheet -->
    <link href="css/bootstrap.min.css" rel="stylesheet">

    <!-- Template Stylesheet -->
    <link href="css/style.css" rel="stylesheet">

 <style>
    h1 { margin-top: 30px; }
    .albums { display: flex; flex-wrap: wrap; justify-content: center; }
    .album { background: white; border-radius: 8px; margin: 10px; padding: 10px; width: 220px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
    .album img { width: 200px; height: 150px; object-fit: cover; border-radius: 6px; }
    .album a { text-decoration: none; color: #333; display: block; }
    .album-title { display: block; margin-top: 8px; font-weight: bold; }
    .album-meta { display: block; font-size: 0.875rem; color: #6c757d; }
    .gallery { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 30px; }
    .gallery button { border: 0; padding: 0; margin: 5px; background: none; border-radius: 6px; cursor: zoom-in; }
    .gallery img { width: 200px; height: 150px; object-fit: cover; border-radius: 6px; transition: 0.2s; }
    .gallery button:hover img, .gallery button:focus-visible img { transform: scale(1.05); }
    .lightbox { position: fixed; inset: 0; z-index: 1050; background: rgba(0,0,0,0.9); display: none; align-items: center; justify-content: center; flex-direction: column; }
    .lightbox.active { display: flex; }
    .lightbox img { max-width: 90%; max-height: 80vh; border-radius: 10px; }
    .lightbox p { color: #fff; margin: 10px 20px 0; text-align: center; }
    .lightbox button { position: absolute; border: 0; background: none; color: white; cursor: pointer; line-height: 1; }
    .lightbox .prev, .lightbox .next { top: 50%; transform: translateY(-50%); font-size: 40px; padding: 10px; }
    .prev { left: 10px; }
    .next { right: 10px; }
    .close-btn { top: 15px; right: 20px; font-size: 40px; }
    .gallery-note { color: #6c757d; font-size: 0.875rem; margin-top: 40px; }
    @media (max-width: 575px) {
      .gallery button { width: calc(50% - 10px); }
      .gallery img { width: 100%; height: 120px; }
    }
</style>


</head>




<body>

    <!-- Header Start -->
    <div class="container-fluid bg-dark px-0 site-header">
        <div class="row gx-0">
            <div class="col-lg-3 bg-dark d-none d-xl-block" z-index=-1>
                <a href="index.php" class="navbar-brand w-100 h-100 m-0 p-0 d-flex align-items-center justify-content-center">
                    <img src="img/Logo.png" height=150px> 
					<!--<h1 class="m-0 display-4 text-primary text-uppercase"><img src="img/Logo.png" height=100px> Helderberg<br>Pirates</h1>-->
                </a>
            </div>
            <div class="col-xl-9 d-flex align-items-center">
                <nav class="navbar navbar-expand-xl bg-dark navbar-dark p-3 p-xl-0 px-xl-5 w-100">
                    <a href="index.php" class="navbar-brand d-block d-xl-none">
                        <img src="img/Logo.png" height="56" alt="Helderberg Pirates">
                    </a>
                    <button type="button" class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#navbarCollapse">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse justify-content-between" id="navbarCollapse">
                        <div class="navbar-nav mr-auto py-0">
                            <a href="index.php" class="nav-item nav-link">Home</a>
                            <a href="about.html" class="nav-item nav-link">About</a>
							<!--<a href="shop.html" class="nav-item nav-link">Shop</a>-->
                            <a href="schedule.php" class="nav-item nav-link">Schedule</a>
                            <a href="fixtures.php" class="nav-item nav-link">Fixtures</a>
							<a href="gallery.php" class="nav-item nav-link active">Gallery</a>
                            <a href="contact.html" class="nav-item nav-link">Contact</a>
                            <a href="https://forms.gle/N7LtqnF7r7RMRC8r5" class="nav-item nav-link" target="_blank">Book the Clubhouse<i class="bi bi-arrow-up-right external-icon" aria-hidden="true"></i><span class="visually-hidden"> (opens in a new tab)</span></a>
                            <a href="https://forms.gle/ru51iYuxmogGMkm86" class="nav-item nav-link" target="_blank">Become a Pirate<i class="bi bi-arrow-up-right external-icon" aria-hidden="true"></i><span class="visually-hidden"> (opens in a new tab)</span></a>
                        </div>
                        <div class="d-flex gap-2 py-3 py-xl-0">
                            <a class="btn btn-primary btn-square rounded-circle" href="https://www.facebook.com/profile.php?id=61581433657465" target="_blank" aria-label="Facebook (opens in a new tab)"><i class="fab fa-facebook-f"></i></a>
                            <a class="btn btn-primary btn-square rounded-circle" href="https://www.instagram.com/helderbergpirates/" target="_blank" aria-label="Instagram (opens in a new tab)"><i class="fab fa-instagram"></i></a>
                        </div>
                    </div>
                </nav>
            </div>
        </div>
    </div>
    <!-- Header End -->

    <main class="site-main">




    <!-- Class Timetable Start -->
    <div class="container-fluid p-5">
        <div class="mb-5 text-center">
            <!--<h5 class="text-primary text-uppercase">Gallery</h5>-->
            <h1 class="display-3 text-uppercase mb-0">Gallery</h1>
        </div>
        <div class="tab-class text-center">
            <!--Gallery data goes here-->

  <?php if ($album): ?>
    <h2><?php echo e($album['title']); ?></h2>
    <?php if ($album['date']): ?>
      <p class="album-meta"><?php echo e(album_date($album['date'])); ?></p>
    <?php endif; ?>
    <a href="gallery.php">← Back to albums</a>
    <div class="gallery">
      <?php foreach ($album['photos'] as $i => $photo):
        $alt = $photo['caption'] !== '' ? $photo['caption'] : 'Photo ' . ($i + 1) . ' from ' . $album['title'];
      ?>
        <button type="button" data-full="<?php echo e(photo_url($photo['full'])); ?>" data-caption="<?php echo e($photo['caption']); ?>">
          <img src="<?php echo e(photo_url($photo['thumb'])); ?>" alt="<?php echo e($alt); ?>" loading="lazy">
        </button>
      <?php endforeach; ?>
    </div>
  <?php elseif ($albumMissing): ?>
    <p>That album isn't in the gallery any more.</p>
    <a href="gallery.php">← Back to albums</a>
  <?php elseif (!$albums): ?>
    <p>Photos are on their way. In the meantime, see the club on <a href="https://www.instagram.com/helderbergpirates/" target="_blank">Instagram<span class="visually-hidden"> (opens in a new tab)</span></a>.</p>
  <?php else: ?>
    <div class="albums">
      <?php foreach ($albums as $each): ?>
      <div class="album">
        <a href="?album=<?php echo rawurlencode($each['slug']); ?>">
          <img src="<?php echo e(photo_url($each['cover'])); ?>" alt="" loading="lazy">
          <span class="album-title"><?php echo e($each['title']); ?></span>
          <span class="album-meta">
            <?php echo $each['date'] ? e(album_date($each['date'])) . ' · ' : ''; ?>
            <?php echo count($each['photos']) === 1 ? '1 photo' : count($each['photos']) . ' photos'; ?>
          </span>
        </a>
      </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <p class="gallery-note">Photos © Helderberg Pirates. Please don't reuse them without the club's permission.</p>

  <div class="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer">
    <button type="button" class="close-btn" aria-label="Close">&times;</button>
    <button type="button" class="nav-btn prev" aria-label="Previous photo">&#10094;</button>
    <img src="" alt="">
    <button type="button" class="nav-btn next" aria-label="Next photo">&#10095;</button>
    <p></p>
  </div>
			<!--gallery data ends here-->
        </div>
    </div>
	

    
    

    </main>

    <!-- Footer Start -->
    <div class="container-fluid bg-dark text-secondary px-5 mt-5 site-footer">
        <div class="row gx-5">
            <div class="col-lg-8 col-md-6">
                <div class="row gx-5">
                    <div class="col-lg-4 col-md-12 pt-5 mb-5">
                        <h4 class="text-uppercase text-light mb-4">Get In Touch</h4>
                        <div class="d-flex mb-2">
                            <i class="bi bi-geo-alt text-primary me-2"></i>
                            <p class="mb-0">Radloff Park</p>
                        </div>
                        <div class="d-flex mb-2">
                            <i class="bi bi-envelope-open text-primary me-2"></i>
                            <p class="mb-0"><a href="mailto:info@helderbergpirates.co.za" class="text-reset">info@helderbergpirates.co.za</a></p>
                        </div>
                        <div class="d-flex mb-2">
                            <i class="bi bi-telephone text-primary me-2"></i>
                            <p class="mb-0"><a href="tel:+27769093707" class="text-reset">076 909 3707</a></p>
                        </div>
                        <div class="d-flex mt-4">
                           
                            <a class="btn btn-primary btn-square rounded-circle me-2" href="https://www.facebook.com/profile.php?id=61581433657465" target="_blank" aria-label="Facebook (opens in a new tab)"><i class="fab fa-facebook-f"></i></a>
                          
                            <a class="btn btn-primary btn-square rounded-circle" href="https://www.instagram.com/helderbergpirates/" target="_blank" aria-label="Instagram (opens in a new tab)"><i class="fab fa-instagram"></i></a>
                        </div>
                    </div>
                     <div class="col-lg-4 col-md-12 pt-0 pt-lg-5 mb-5">
                        <h4 class="text-uppercase text-light mb-4">Quick Links</h4>
                        <div class="d-flex flex-column justify-content-start">
                            <a class="text-secondary mb-2" href="index.php"><i class="bi bi-arrow-right text-primary me-2"></i>Home</a>
                            <a class="text-secondary mb-2" href="about.html"><i class="bi bi-arrow-right text-primary me-2"></i>About Us</a>
                            <a class="text-secondary mb-2" href="schedule.php"><i class="bi bi-arrow-right text-primary me-2"></i>Schedule</a>
                            <a class="text-secondary mb-2" href="fixtures.php"><i class="bi bi-arrow-right text-primary me-2"></i>Fixtures</a>
                            <!--<a class="text-secondary mb-2" href="#"><i class="bi bi-arrow-right text-primary me-2"></i>Our Coaches</a>-->
                            <a class="text-secondary" href="contact.html"><i class="bi bi-arrow-right text-primary me-2"></i>Contact Us</a>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-12 pt-0 pt-lg-5 mb-5">
                        <h4 class="text-uppercase text-light mb-4">Popular Links</h4>
                        <div class="d-flex flex-column justify-content-start">
                            <a class="text-secondary mb-2" href="index.php"><i class="bi bi-arrow-right text-primary me-2"></i>Home</a>
                            <a class="text-secondary mb-2" href="about.html"><i class="bi bi-arrow-right text-primary me-2"></i>About Us</a>
                            <a class="text-secondary mb-2" href="schedule.php"><i class="bi bi-arrow-right text-primary me-2"></i>Schedule</a>
                            <a class="text-secondary mb-2" href="fixtures.php"><i class="bi bi-arrow-right text-primary me-2"></i>Fixtures</a>
                            <!--<a class="text-secondary mb-2" href="#"><i class="bi bi-arrow-right text-primary me-2"></i>Our Coaches</a>-->
                            <a class="text-secondary" href="contact.html"><i class="bi bi-arrow-right text-primary me-2"></i>Contact Us</a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-4 col-md-6">
                <div class="d-flex flex-column align-items-center justify-content-center text-center h-100 bg-primary p-5">
                    <h4 class="text-uppercase text-white mb-4">Our Sponsors</h4>
                    <!--<h6 class="text-uppercase text-white">Thanks goes out to our sponsors</h6>-->
                    <!--<p class="text-light">He</p>-->
                    <div class="container-fluid p-0 mb-5">
        <div id="header-carousel" class="carousel slide" data-bs-ride="carousel">
            <div class="carousel-inner">
                <div class="carousel-item active">
                    <a href="https://www.jdwglass.co.za/" target="_blank" aria-label="JDW Glass (opens in a new tab)"> <img class="w-100" src="img/jdw.jpg" alt="Image"></a>
                </div>
                <div class="carousel-item">
                   <a href="https://purecoatings.co.za/" target="_blank" aria-label="Pure Coatings (opens in a new tab)"> <img class="w-100" src="img/pure_coating.png" alt="Image"></a>
                </div>
				<div class="carousel-item">
                    <a href="https://www.sundancepools.co.za/" target="_blank" aria-label="Sundance Pools (opens in a new tab)"><img class="w-80" src="img/sundance.jpg" alt="Image"></a>
                </div>
				<div class="carousel-item">
                    <a href="https://www.archo.co.za/" target="_blank" aria-label="Archo (opens in a new tab)"><img class="w-50" src="img/archo_black_logo.png" alt="Image"></a>
                </div>
            </div>
        </div>
    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="container-fluid py-4 py-lg-0 px-5 site-footer-bar" style="background: #111111;">
        <div class="row gx-5">
            <div class="col-lg-8">
                <div class="py-lg-4 text-center">
                    <p class="text-secondary mb-0">&copy; <a class="text-light fw-bold" href="#">Helderberg Pirates</a>. All Rights Reserved.</p>
                </div>
            </div>
            <div class="col-lg-4">
                <div class="py-lg-4 text-center credit">
                    <p class="text-light mb-0">Designed by Helderberg Pirates Baseball</p>
                </div>
            </div>
        </div>
    </div>
    <!-- Footer End -->


    <!-- Back to Top -->
    <a href="#" class="btn btn-dark py-3 fs-4 back-to-top"><i class="bi bi-arrow-up"></i></a>


    <!-- JavaScript Libraries -->
    <script src="https://code.jquery.com/jquery-3.4.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="lib/easing/easing.min.js"></script>
    <script src="lib/waypoints/waypoints.min.js"></script>
    <script src="lib/counterup/counterup.min.js"></script>
    <script src="lib/owlcarousel/owl.carousel.min.js"></script>

    <!-- Template Javascript -->
    <script src="js/main.js"></script>
 <script>
  const lightbox = document.querySelector(".lightbox");
  const lbImg = lightbox.querySelector("img");
  const lbCaption = lightbox.querySelector("p");
  const photos = Array.from(document.querySelectorAll(".gallery button"));
  let current = 0;
  let opener = null;

  function show(i) {
    current = (i + photos.length) % photos.length;
    const photo = photos[current];
    lbImg.src = photo.dataset.full;
    lbImg.alt = photo.querySelector("img").alt;
    lbCaption.textContent = photo.dataset.caption;
    // Load the next photo while this one is looked at
    new Image().src = photos[(current + 1) % photos.length].dataset.full;
  }

  function open(i) {
    opener = document.activeElement;
    show(i);
    lightbox.classList.add("active");
    lightbox.querySelector(".close-btn").focus();
  }

  function close() {
    lightbox.classList.remove("active");
    if (opener) opener.focus();
  }

  photos.forEach((photo, i) => photo.addEventListener("click", () => open(i)));
  lightbox.querySelector(".close-btn").onclick = close;
  lightbox.querySelector(".prev").onclick = () => show(current - 1);
  lightbox.querySelector(".next").onclick = () => show(current + 1);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });
  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("active")) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") show(current - 1);
    if (event.key === "ArrowRight") show(current + 1);
  });
  </script>
	
</body>

</html>