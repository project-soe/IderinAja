"use strict";


const screen =
  document.querySelector(".login-screen");

const accountType =
  screen?.dataset.accountType || null;


const backButton =
  document.getElementById("backButton");


const changeAccount =
  document.getElementById("changeAccount");


/*
 * Kembali ke Auth 02
 */

backButton?.addEventListener(
  "click",
  () => {

    window.location.href =
      "account-type.html";

  }
);


/*
 * Ganti jenis akun
 */

changeAccount?.addEventListener(
  "click",
  () => {

    window.location.href =
      "account-type.html";

  }
);


/*
 * Tombol autentikasi
 *
 * Auth 03 → Auth 04
 * Menyimpan konteks akun dan aksi,
 * kemudian membuka halaman Phone Auth.
 */

document
  .querySelectorAll("[data-action]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;

      if (!accountType) {
        return;
      }

      sessionStorage.setItem(
        "iderinaja_account_type",
        accountType
      );

      sessionStorage.setItem(
        "iderinaja_auth_action",
        action
      );

      console.log(
        "Auth action:",
        action,
        "Account:",
        accountType
      );

      window.location.href = "phone-auth.html";
    });
  });
