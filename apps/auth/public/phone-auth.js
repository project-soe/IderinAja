import {
  firebaseApp,
  firestoreDb,
} from "./firebase/config.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const auth = getAuth(firebaseApp);
const db = firestoreDb;
// =====================================================
// ELEMENTS
// =====================================================

const phoneForm =
  document.getElementById("phoneForm");

const phoneInput =
  document.getElementById("phoneNumber");

const sendOtpButton =
  document.getElementById("sendOtpButton");

const otpSection =
  document.getElementById("otpSection");

const otpInput =
  document.getElementById("otpCode");

const verifyOtpButton =
  document.getElementById("verifyOtpButton");

const statusElement =
  document.getElementById("status");

const roleBadge =
  document.getElementById("roleBadge");

// =====================================================
// ACCOUNT TYPE
// =====================================================

const accountType =
  sessionStorage.getItem(
    "iderinaja_account_type"
  ) || "customer";

if (accountType === "vendor") {
  roleBadge.textContent =
    "Mitra Pedagang";
} else {
  roleBadge.textContent =
    "Konsumen";
}

// =====================================================
// STATE
// =====================================================

let confirmationResult = null;
let recaptchaVerifier = null;

// =====================================================
// STATUS
// =====================================================

function setStatus(
  message,
  type = ""
) {
  statusElement.textContent =
    message;

  statusElement.className =
    `status ${type}`;
}

// =====================================================
// PHONE NORMALIZATION
// =====================================================

function normalizePhoneNumber(
  value
) {
  let phone =
    value
      .trim()
      .replace(/[\s-]/g, "");

  if (phone.startsWith("08")) {
    phone =
      "+62" +
      phone.slice(1);
  }

  return phone;
}

// =====================================================
// RECAPTCHA
// =====================================================

function initializeRecaptcha() {
  if (recaptchaVerifier) {
    return;
  }

  recaptchaVerifier =
    new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "normal",

        callback: () => {
          setStatus(
            "Verifikasi reCAPTCHA berhasil.",
            "success"
          );
        },

        "expired-callback": () => {
          setStatus(
            "reCAPTCHA kedaluwarsa. Silakan verifikasi kembali.",
            "error"
          );
        },
      }
    );

  recaptchaVerifier
    .render()
    .catch((error) => {
      console.error(
        "reCAPTCHA error:",
        error
      );

      setStatus(
        `reCAPTCHA gagal: ${
          error?.code || "unknown"
        } — ${
          error?.message ||
          "Tidak ada pesan error."
        }`,
        "error"
      );
    });
}

// =====================================================
// INITIALIZE RECAPTCHA
// =====================================================

initializeRecaptcha();

// =====================================================
// SEND OTP
// =====================================================

phoneForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const phoneNumber =
      normalizePhoneNumber(
        phoneInput.value
      );

    if (
      !/^\+62\d{9,13}$/.test(
        phoneNumber
      )
    ) {
      setStatus(
        "Nomor HP tidak valid. Contoh: 081234567890",
        "error"
      );

      return;
    }

    sendOtpButton.disabled = true;

    setStatus(
      "Mengirim kode OTP..."
    );

    try {
      confirmationResult =
        await signInWithPhoneNumber(
          auth,
          phoneNumber,
          recaptchaVerifier
        );

      otpSection.classList.add(
        "active"
      );

      phoneInput.disabled = true;

      setStatus(
        "Kode OTP sudah dikirim ke nomor HP kamu.",
        "success"
      );

    } catch (error) {
      console.error(
        "Phone Auth error:",
        error
      );

      sendOtpButton.disabled =
        false;

      setStatus(
        getFirebaseErrorMessage(
          error
        ),
        "error"
      );

      // Reset reCAPTCHA
      try {
        if (recaptchaVerifier) {
          recaptchaVerifier.clear();
          recaptchaVerifier = null;

          initializeRecaptcha();
        }
      } catch (
        recaptchaError
      ) {
        console.error(
          recaptchaError
        );
      }
    }
  }
);

// =====================================================
// VERIFY OTP
// =====================================================

verifyOtpButton.addEventListener(
  "click",
  async () => {
    const code =
      otpInput.value.trim();

    if (!confirmationResult) {
      setStatus(
        "Silakan minta kode OTP terlebih dahulu.",
        "error"
      );

      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setStatus(
        "Kode OTP harus terdiri dari 6 digit.",
        "error"
      );

      return;
    }

    verifyOtpButton.disabled =
      true;

    setStatus(
      "Memverifikasi OTP..."
    );

    try {
      // =========================================
      // FIREBASE AUTH
      // =========================================

      const result =
        await confirmationResult.confirm(
          code
        );

      const user =
        result.user;
console.log("=== FIRESTORE REST TEST ===");

try {
  const idToken = await user.getIdToken();

  const url =
    `https://firestore.googleapis.com/v1/projects/absensitamu/databases/(default)/documents/users/${user.uid}`;

  console.log("REST URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const responseText =
    await response.text();

  console.log(
    "REST HTTP STATUS:",
    response.status
  );

  console.log(
    "REST RESPONSE:",
    responseText
  );

} catch (error) {
  console.error(
    "REST TEST ERROR:",
    error
  );
}
      console.log(
        "Firebase User:",
        user
      );

      // =========================================
      // FIRESTORE USER PROFILE
      // =========================================

      const userRef =
        doc(
          db,
          "users",
          user.uid
        );

      const userSnapshot =
        await getDoc(
          userRef
        );

      if (
        !userSnapshot.exists()
      ) {
        await setDoc(
          userRef,
          {
            uid: user.uid,

            role: accountType,

            phoneNumber:
              user.phoneNumber ||
              "",

            displayName: "",

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

        console.log(
          "Firestore profile created."
        );

      } else {
        await setDoc(
          userRef,
          {
            phoneNumber:
              user.phoneNumber ||
              "",

            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          }
        );

        console.log(
          "Firestore profile updated."
        );
      }

      // =========================================
      // SESSION
      // =========================================

      sessionStorage.setItem(
        "iderinaja_uid",
        user.uid
      );

      sessionStorage.setItem(
        "iderinaja_phone",
        user.phoneNumber ||
          ""
      );

      sessionStorage.setItem(
        "iderinaja_account_type",
        accountType
      );

      // =========================================
      // SUCCESS
      // =========================================

      setStatus(
        "Verifikasi berhasil. Login berhasil.",
        "success"
      );

      console.log(
        "AUTH SUCCESS",
        {
          uid: user.uid,
          phoneNumber:
            user.phoneNumber,
          accountType,
        }
      );

      // =========================================
      // REDIRECT
      // =========================================

      if (
        accountType ===
        "vendor"
      ) {
        window.location.href =
          "vendor-dashboard.html";
      } else {
        window.location.href =
          "customer-dashboard.html";
      }

    } catch (error) {
      console.error(
        "OTP verification error:",
        error
      );

      verifyOtpButton.disabled =
        false;

      setStatus(
        getFirebaseErrorMessage(
          error
        ),
        "error"
      );
    }
  }
);

// =====================================================
// FIREBASE ERROR MESSAGE
// =====================================================

function getFirebaseErrorMessage(
  error
) {
  switch (error?.code) {

    case "auth/invalid-phone-number":
      return "Nomor HP tidak valid.";

    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Coba lagi nanti.";

    case "auth/quota-exceeded":
      return "Kuota SMS Firebase sudah tercapai.";

    case "auth/invalid-verification-code":
      return "Kode OTP salah.";

    case "auth/code-expired":
      return "Kode OTP sudah kedaluwarsa. Minta kode baru.";

    case "auth/captcha-check-failed":
      return "Verifikasi reCAPTCHA gagal.";

    case "auth/operation-not-allowed":
      return "Phone Authentication belum diaktifkan.";

    case "auth/network-request-failed":
      return "Koneksi internet bermasalah.";

    case "unavailable":
      return "Firestore tidak dapat terhubung. Client dianggap offline.";

    case "permission-denied":
      return "Akses Firestore ditolak oleh Security Rules.";

    case "failed-precondition":
      return "Firestore membutuhkan konfigurasi tambahan.";

    default:
      return (
        error?.message ||
        "Terjadi kesalahan saat autentikasi."
      );
  }
}
