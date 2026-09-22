"use strict";

const accountCards = document.querySelectorAll(".account-card");
const loginButton = document.getElementById("loginButton");


accountCards.forEach((card) => {

  card.addEventListener("click", () => {

    const accountType = card.dataset.account;

    if (!accountType) {
      return;
    }

    /*
     * Untuk sementara kita simpan pilihan akun
     * di sessionStorage.
     *
     * Firebase Auth belum dipanggil pada tahap ini.
     */

    sessionStorage.setItem(
      "iderinaja_account_type",
      accountType
    );


    /*
     * Tujuan berikutnya:
     *
     * vendor   → login-vendor.html
     * customer → login-customer.html
     *
     * File tersebut akan kita buat pada
     * Layout Auth berikutnya.
     */

    if (accountType === "vendor") {

      window.location.href = "login-vendor.html";

      return;
    }


    if (accountType === "customer") {

      window.location.href = "login-customer.html";

    }

  });

});


/*
 * Login umum.
 *
 * Untuk sekarang kita arahkan ke halaman
 * berdasarkan pilihan akun terakhir.
 */

loginButton?.addEventListener("click", () => {

  const savedAccount =
    sessionStorage.getItem(
      "iderinaja_account_type"
    );


  if (savedAccount === "vendor") {

    window.location.href = "login-vendor.html";

    return;
  }


  if (savedAccount === "customer") {

    window.location.href = "login-customer.html";

    return;
  }


  /*
   * Kalau belum pernah memilih akun,
   * kembali ke pemilihan akun.
   */

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

});
