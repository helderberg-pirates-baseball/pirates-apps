<html lang="en">

<head>
    <meta charset="utf-8">
    <title>Helderberg Pirates Baseball</title>
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <meta name="description" content="Every 2026&ndash;27 game for the Helderberg Pirates teams, home and away. Filter by team or search for an opponent.">

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
                            <a href="fixtures.php" class="nav-item nav-link active">Fixtures</a>
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
        <!-- The fixtures come from outside this repo; see fixtures-frame.php -->
        <iframe src="fixtures-frame.php" class="fixtures-frame" title="2026&ndash;27 match fixtures"></iframe>
        <script>
            // The frame is made as tall as the fixtures inside it, so the whole
            // page scrolls like the other pages and the header scrolls away
            const frame = document.querySelector(".fixtures-frame");
            frame.addEventListener("load", function () {
                const fixtures = frame.contentDocument.documentElement;
                // Their page makes itself exactly as tall as the frame; let it
                // be as tall as its content instead, so it can be measured
                fixtures.style.height = "auto";
                frame.contentDocument.body.style.height = "auto";

                function fitToFixtures() {
                    frame.style.height = Math.ceil(fixtures.getBoundingClientRect().height) + "px";
                }
                // Switching tabs or filtering changes the height
                new ResizeObserver(fitToFixtures).observe(fixtures);
                fitToFixtures();
            });
        </script>
    </main>


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

</body>

</html>
