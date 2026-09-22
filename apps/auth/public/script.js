/* ============================================================
   IDERINAJA
   AUTH / ONBOARDING — LAYOUT 01
   SPLASH SCREEN

   Vanilla JavaScript
   No external JavaScript dependency.
   ============================================================ */


/* ============================================================
   01. DOM REFERENCES
   ============================================================ */

const splashScreen =
    document.getElementById("splashScreen");

const skipButton =
    document.getElementById("skipButton");

const swipeHint =
    document.getElementById("swipeHint");

const currentTime =
    document.getElementById("currentTime");

const pageDots =
    document.querySelectorAll(".page-dot");


/* ============================================================
   02. APPLICATION STATE
   ============================================================ */

let currentPage = 0;

const TOTAL_PAGES = 3;


/* ============================================================
   03. DEVICE CLOCK
   ============================================================

   Digunakan hanya untuk membuat status bar prototype
   terlihat seperti aplikasi mobile sebenarnya.

   Pada production, status bar native perangkat tidak perlu
   dibuat menggunakan JavaScript.
   ============================================================ */

function updateClock() {

    if (!currentTime) {
        return;
    }

    const now = new Date();

    currentTime.textContent =
        now.toLocaleTimeString(
            "id-ID",
            {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }
        );

}


/* Jalankan pertama kali */
updateClock();


/*
   Update setiap 30 detik.
*/
setInterval(
    updateClock,
    30000
);


/* ============================================================
   04. PAGE NAVIGATION
   ============================================================ */

/**
 * Mengubah halaman onboarding.
 *
 * @param {number} pageIndex
 */
function setPage(pageIndex) {

    /*
       Pastikan index tidak keluar dari range.
    */

    currentPage =
        Math.max(
            0,
            Math.min(
                TOTAL_PAGES - 1,
                pageIndex
            )
        );


    /*
       Update indikator halaman.
    */

    pageDots.forEach(
        (dot, index) => {

            dot.classList.toggle(
                "page-dot--active",
                index === currentPage
            );

        }
    );


    /*
       Event custom untuk halaman berikutnya.

       Nanti dapat diganti dengan:

       window.location.href = "/auth/account-type.html";

       atau router framework.
    */

    document.dispatchEvent(
        new CustomEvent(
            "iderinaja:navigate",
            {
                detail: {
                    page: currentPage
                }
            }
        )
    );


    console.log(
        "IderinAja navigation:",
        currentPage
    );

}


/* ============================================================
   05. PAGE DOT EVENTS
   ============================================================ */

pageDots.forEach(
    (dot) => {

        dot.addEventListener(
            "click",
            () => {

                const page =
                    Number(
                        dot.dataset.page
                    );

                setPage(page);

            }
        );

    }
);


/* ============================================================
   06. SKIP BUTTON
   ============================================================ */

skipButton.addEventListener(
    "click",
    () => {

        /*
           Untuk MVP:

           Splash
             ↓
           Pilih Jenis Akun

           Halaman berikutnya akan kita buat setelah ini.
        */

        setPage(1);

    }
);


/* ============================================================
   07. TOUCH / SWIPE GESTURE
   ============================================================ */

let touchStartX = 0;
let touchStartY = 0;


/*
   Touch Start
*/

splashScreen.addEventListener(
    "touchstart",
    (event) => {

        const touch =
            event.changedTouches[0];

        touchStartX =
            touch.clientX;

        touchStartY =
            touch.clientY;

    },
    {
        passive: true
    }
);


/*
   Touch End
*/

splashScreen.addEventListener(
    "touchend",
    (event) => {

        const touch =
            event.changedTouches[0];

        const deltaX =
            touch.clientX - touchStartX;

        const deltaY =
            touch.clientY - touchStartY;


        /*
           Abaikan gerakan vertikal.
        */

        if (
            Math.abs(deltaX) < 50 ||
            Math.abs(deltaX) <= Math.abs(deltaY)
        ) {

            return;

        }


        /*
           Swipe kiri:
           halaman berikutnya.
        */

        if (
            deltaX < 0 &&
            currentPage < TOTAL_PAGES - 1
        ) {

            setPage(
                currentPage + 1
            );

        }


        /*
           Swipe kanan:
           halaman sebelumnya.
        */

        if (
            deltaX > 0 &&
            currentPage > 0
        ) {

            setPage(
                currentPage - 1
            );

        }

    },
    {
        passive: true
    }
);


/* ============================================================
   08. HIDE SWIPE HINT
   ============================================================ */

function hideSwipeHint() {

    if (!swipeHint) {
        return;
    }

    swipeHint.style.opacity = "0";

    swipeHint.style.pointerEvents =
        "none";

}


/*
   Begitu pengguna menyentuh layar,
   hint tidak diperlukan lagi.
*/

splashScreen.addEventListener(
    "touchstart",
    hideSwipeHint,
    {
        once: true,
        passive: true
    }
);


/* ============================================================
   09. AUTH NAVIGATION
   ============================================================ */

/**
 * Membuka Auth 02:
 * Pilih jenis akun
 */
function navigateToAccountType() {
  window.location.href = "account-type.html";
}


/**
 * Navigasi antar halaman onboarding.
 *
 * page menggunakan index 0:
 *
 * page 0 = halaman pertama
 * page 1 = halaman kedua
 * page 2 = halaman terakhir
 */
document.addEventListener(
  "iderinaja:navigate",
  (event) => {

    const page = event.detail?.page;

    console.log(
      `Navigasi ke onboarding page ${page + 1}`
    );


    /*
     * Jika sudah sampai halaman onboarding terakhir,
     * lanjut otomatis ke Auth 02.
     */
    if (page === 2) {

      setTimeout(() => {
        navigateToAccountType();
      }, 700);

    }

  }
);


/**
 * Tombol "Lewati"
 */
const skipTombol = document.getElementById("skipButton");

if (skipTombol) {

  skipTombol.addEventListener(
    "click",
    () => {

      navigateToAccountType();

    }
  );

};
