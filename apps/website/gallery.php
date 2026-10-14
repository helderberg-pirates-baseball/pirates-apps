<?php
$albums = array_filter(glob('uploads/*'), 'is_dir');
?>
<html lang="en">

<head>
    <meta charset="utf-8">
    <title>Helderberg Pirates Baseball</title>
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
    .album { background: white; border-radius: 8px; margin: 10px; padding: 10px; width: 180px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
    .album img { width: 160px; height: 120px; object-fit: cover; border-radius: 6px; }
    .album a { text-decoration: none; color: #333; display: block; margin-top: 8px; font-weight: bold; }
    .gallery { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 30px; }
    .gallery img { width: 160px; height: 120px; object-fit: cover; border-radius: 6px; margin: 5px; cursor: pointer; transition: 0.2s; }
    .gallery img:hover { transform: scale(1.05); }
    .lightbox { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.8); display:none; align-items:center; justify-content:center; flex-direction:column; }
    .lightbox.active { display:flex; }
    .lightbox img { max-width:90%; max-height:80%; border-radius:10px; }
    .lightbox p { color:#fff; margin-top:10px; }
    .nav-btn { position:absolute; top:50%; font-size:40px; color:white; cursor:pointer; user-select:none; }
    .prev { left:30px; }
    .next { right:30px; }
    .close-btn { position:absolute; top:20px; right:30px; font-size:35px; color:white; cursor:pointer; }
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
                            <a href="index.php" class="nav-item nav-link active">Home</a>
                            <a href="about.html" class="nav-item nav-link">About</a>
							<!--<a href="shop.html" class="nav-item nav-link">Shop</a>-->
                            <a href="schedule.php" class="nav-item nav-link">Schedule</a>
                            <a href="fixtures.php" class="nav-item nav-link">Fixtures</a>
							<a href="gallery.php" class="nav-item nav-link">Gallery</a>
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

  <?php if (!isset($_GET['album'])): ?>
    <div class="albums">
      <?php foreach ($albums as $albumPath): 
        $album = basename($albumPath);
        $images = glob("$albumPath/*.{jpg,jpeg,png,gif}", GLOB_BRACE);
        $thumb = count($images) ? $images[0] : "uploads/default.jpg";
      ?>
      <div class="album">
        <a href="?album=<?php echo urlencode($album); ?>">
          <img src="<?php echo htmlspecialchars($thumb); ?>" onerror="this.src='uploads/default.jpg'">
          <?php echo htmlspecialchars($album); ?>
        </a>
      </div>
      <?php endforeach; ?>
    </div>
  <?php else: 
    $album = basename($_GET['album']);
    $images = glob("uploads/$album/*.{jpg,jpeg,png,gif}", GLOB_BRACE);
  ?>
    <h2><?php echo htmlspecialchars($album); ?></h2>
    <a href="gallery.php">← Back to albums</a>
    <div class="gallery">
      <?php foreach ($images as $i => $img): ?>
        <img src="<?php echo htmlspecialchars($img); ?>" data-index="<?php echo $i; ?>">
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <div class="lightbox">
    <span class="close-btn">&times;</span>
    <span class="nav-btn prev">&#10094;</span>
    <img src="">
    <span class="nav-btn next">&#10095;</span>
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
  const imgs = document.querySelectorAll(".gallery img");
  let current = 0;

  function show(i) {
    if (i < 0) i = imgs.length - 1;
    if (i >= imgs.length) i = 0;
    current = i;
    lbImg.src = imgs[i].src;
    lightbox.classList.add("active");
  }

  imgs.forEach((img, i) => img.addEventListener("click", () => show(i)));
  document.querySelector(".close-btn").onclick = () => lightbox.classList.remove("active");
  document.querySelector(".prev").onclick = () => show(current - 1);
  document.querySelector(".next").onclick = () => show(current + 1);
  </script>
	
</body>

</html>