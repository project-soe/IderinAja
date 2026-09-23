/**
 * ==================================================
 * IDERINAJA — VENDOR DASHBOARD
 * ==================================================
 *
 * FITUR:
 * - Authentication
 * - Role verification
 * - Vendor profile
 * - Unique username
 * - Live GPS
 * - Vendor profile migration
 * - Vendor location migration
 * - Menu & stock CRUD
 *
 * FIRESTORE:
 *
 * users/{uid}
 *
 * vendorProfiles/{uid}
 *
 * vendorLocations/{uid}
 *
 * vendorMenus/{vendorUid}/items/{itemId}
 *
 * Legacy sementara:
 * vendors/{uid}
 * ==================================================
 */

import {
  firebaseApp,
  firestoreDb,
} from "./firebase/config.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* ==================================================
   FIREBASE
================================================== */

const auth = getAuth(firebaseApp);

const db = firestoreDb;


/* ==================================================
   DOM — PROFILE
================================================== */

const businessProfileForm =
  document.getElementById(
    "businessProfileForm"
  );

const businessNameInput =
  document.getElementById(
    "businessName"
  );

const usernameInput =
  document.getElementById(
    "username"
  );

const categoryInput =
  document.getElementById(
    "category"
  );

const saveProfileButton =
  document.getElementById(
    "saveProfile"
  );

const profileMessage =
  document.getElementById(
    "profileMessage"
  );

const logoutButton =
  document.getElementById(
    "logoutButton"
  );


/* ==================================================
   DOM — GPS
================================================== */

const startLocationButton =
  document.getElementById(
    "startLocation"
  );

const stopLocationButton =
  document.getElementById(
    "stopLocation"
  );

const statusDot =
  document.getElementById(
    "statusDot"
  );

const locationStatus =
  document.getElementById(
    "locationStatus"
  );

const message =
  document.getElementById(
    "message"
  );

const latitudeElement =
  document.getElementById(
    "latitude"
  );

const longitudeElement =
  document.getElementById(
    "longitude"
  );

const accuracyElement =
  document.getElementById(
    "accuracy"
  );

const onlineState =
  document.getElementById(
    "onlineState"
  );


/* ==================================================
   DOM — MENU
================================================== */

const menuForm =
  document.getElementById(
    "menuForm"
  );

const menuIdInput =
  document.getElementById(
    "menuId"
  );

const menuNameInput =
  document.getElementById(
    "menuName"
  );

const menuDescriptionInput =
  document.getElementById(
    "menuDescription"
  );

const menuPriceInput =
  document.getElementById(
    "menuPrice"
  );

const menuStockInput =
  document.getElementById(
    "menuStock"
  );

const menuAvailableInput =
  document.getElementById(
    "menuAvailable"
  );

const saveMenuButton =
  document.getElementById(
    "saveMenu"
  );

const cancelMenuEditButton =
  document.getElementById(
    "cancelMenuEdit"
  );

const menuMessage =
  document.getElementById(
    "menuMessage"
  );

const menuList =
  document.getElementById(
    "menuList"
  );

const menuEmpty =
  document.getElementById(
    "menuEmpty"
  );

const menuCount =
  document.getElementById(
    "menuCount"
  );


/* ==================================================
   APPLICATION STATE
================================================== */

let currentUser = null;

let watchId = null;

let lastUploadedLocation = null;

let currentUsername = null;


/* ==================================================
   CONSTANTS
================================================== */

const USERNAME_PATTERN =
  /^[a-z0-9_]{3,30}$/;


const MIN_LOCATION_UPDATE_DISTANCE_METERS =
  10;


/* ==================================================
   UI HELPERS
================================================== */

function showProfileMessage(
  text,
  type = ""
) {
  if (!profileMessage) {
    return;
  }

  profileMessage.textContent =
    text;

  profileMessage.className =
    `message ${type}`;
}


function showLocationMessage(
  text,
  type = ""
) {
  if (!message) {
    return;
  }

  message.textContent =
    text;

  message.className =
    `message ${type}`;
}


function showMenuMessage(
  text,
  type = ""
) {
  if (!menuMessage) {
    return;
  }

  menuMessage.textContent =
    text;

  menuMessage.className =
    `message ${type}`;
}


/* ==================================================
   VALIDATION
================================================== */

function normalizeUsername(
  value
) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}


function validateUsername(
  username
) {
  return USERNAME_PATTERN.test(
    username
  );
}


function validateBusinessName(
  name
) {
  const normalized =
    name.trim();

  return (
    normalized.length >= 2 &&
    normalized.length <= 80
  );
}


function validateMenuName(
  name
) {
  const normalized =
    name.trim();

  return (
    normalized.length >= 2 &&
    normalized.length <= 80
  );
}


function validatePrice(
  price
) {
  return (
    Number.isFinite(price) &&
    price >= 0
  );
}


function validateStock(
  stock
) {
  return (
    Number.isInteger(stock) &&
    stock >= 0
  );
}


/* ==================================================
   CURRENCY
================================================== */

function formatCurrency(
  value
) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}


/* ==================================================
   GEOLOCATION
================================================== */

function calculateDistance(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  const earthRadius =
    6371000;

  const toRadians =
    (degrees) =>
      degrees *
      Math.PI /
      180;

  const deltaLatitude =
    toRadians(
      latitude2 -
      latitude1
    );

  const deltaLongitude =
    toRadians(
      longitude2 -
      longitude1
    );

  const a =
    Math.sin(
      deltaLatitude / 2
    ) ** 2 +

    Math.cos(
      toRadians(latitude1)
    ) *

    Math.cos(
      toRadians(latitude2)
    ) *

    Math.sin(
      deltaLongitude / 2
    ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return (
    earthRadius * c
  );
}


/* ==================================================
   LOAD VENDOR PROFILE
================================================== */

async function loadVendorProfile() {

  if (!currentUser) {
    return;
  }


  const profileRef =
    doc(
      db,
      "vendorProfiles",
      currentUser.uid
    );


  const snapshot =
    await getDoc(
      profileRef
    );


  if (snapshot.exists()) {

    const vendor =
      snapshot.data();


    businessNameInput.value =
      vendor.businessName ||
      "";

    usernameInput.value =
      vendor.username ||
      "";

    categoryInput.value =
      vendor.category ||
      "";

    currentUsername =
      vendor.username ||
      null;

  } else {

    /* ----------------------------------------------
       FALLBACK LEGACY
    ---------------------------------------------- */

    const legacyRef =
      doc(
        db,
        "vendors",
        currentUser.uid
      );


    const legacySnapshot =
      await getDoc(
        legacyRef
      );


    if (legacySnapshot.exists()) {

      const vendor =
        legacySnapshot.data();


      businessNameInput.value =
        vendor.businessName ||
        "";

      usernameInput.value =
        vendor.username ||
        "";

      categoryInput.value =
        vendor.category ||
        "";

      currentUsername =
        vendor.username ||
        null;
    }
  }


  /* ----------------------------------------------
     LOAD LOCATION STATE
  ---------------------------------------------- */

  const locationRef =
    doc(
      db,
      "vendorLocations",
      currentUser.uid
    );


  const locationSnapshot =
    await getDoc(
      locationRef
    );


  if (
    locationSnapshot.exists()
  ) {

    const location =
      locationSnapshot.data();


    if (
      typeof location.latitude ===
      "number" &&

      typeof location.longitude ===
      "number"
    ) {

      latitudeElement.textContent =
        location.latitude.toFixed(
          6
        );

      longitudeElement.textContent =
        location.longitude.toFixed(
          6
        );
    }


    if (
      typeof location.accuracy ===
      "number"
    ) {

      accuracyElement.textContent =
        `${Math.round(
          location.accuracy
        )} meter`;
    }


    if (
      location.isOnline ===
      true
    ) {

      onlineState.textContent =
        "Online";

      statusDot.classList.add(
        "online"
      );

      locationStatus.textContent =
        "Lokasi sedang dibagikan";
    }
  }
}


/* ==================================================
   RESERVE USERNAME
================================================== */

async function reserveUsername(
  username
) {

  const usernameRef =
    doc(
      db,
      "usernames",
      username
    );


  const vendorRef =
    doc(
      db,
      "vendors",
      currentUser.uid
    );


  await runTransaction(
    db,
    async (
      transaction
    ) => {

      const usernameSnapshot =
        await transaction.get(
          usernameRef
        );


      if (
        usernameSnapshot.exists()
      ) {

        const existing =
          usernameSnapshot.data();


        if (
          existing.uid !==
          currentUser.uid
        ) {

          throw new Error(
            "USERNAME_ALREADY_TAKEN"
          );
        }
      }


      transaction.set(
        usernameRef,
        {
          uid:
            currentUser.uid,

          username,

          createdAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );


      transaction.set(
        vendorRef,
        {
          uid:
            currentUser.uid,

          username,
        },
        {
          merge: true,
        }
      );
    }
  );
}


/* ==================================================
   SAVE VENDOR PROFILE
================================================== */

async function saveVendorProfile() {

  if (!currentUser) {

    showProfileMessage(
      "Sesi login belum siap.",
      "error"
    );

    return;
  }


  const businessName =
    businessNameInput.value.trim();


  const username =
    normalizeUsername(
      usernameInput.value
    );


  const category =
    categoryInput.value;


  if (
    !validateBusinessName(
      businessName
    )
  ) {

    showProfileMessage(
      "Nama usaha harus 2–80 karakter.",
      "error"
    );

    return;
  }


  if (
    !validateUsername(
      username
    )
  ) {

    showProfileMessage(
      "Username hanya boleh menggunakan huruf kecil, angka, dan underscore.",
      "error"
    );

    return;
  }


  if (!category) {

    showProfileMessage(
      "Silakan pilih kategori dagangan.",
      "error"
    );

    return;
  }


  saveProfileButton.disabled =
    true;


  showProfileMessage(
    "Menyimpan profil..."
  );


  try {

    const profileRef =
      doc(
        db,
        "vendorProfiles",
        currentUser.uid
      );


    const legacyVendorRef =
      doc(
        db,
        "vendors",
        currentUser.uid
      );


    if (
      currentUsername !==
      username
    ) {

      await reserveUsername(
        username
      );

      currentUsername =
        username;
    }


    await setDoc(
      profileRef,
      {
        uid:
          currentUser.uid,

        role:
          "vendor",

        businessName,

        username,

        category,

        isAcceptingOrders:
          true,

        updatedAt:
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );


    await setDoc(
      legacyVendorRef,
      {
        uid:
          currentUser.uid,

        role:
          "vendor",

        businessName,

        username,

        category,

        isLocationVisible:
          true,

        updatedAt:
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );


    usernameInput.value =
      username;


    showProfileMessage(
      "Profil usaha berhasil disimpan.",
      "success"
    );

  } catch (error) {

    console.error(
      "Save vendor profile error:",
      error
    );


    if (
      error.message ===
      "USERNAME_ALREADY_TAKEN"
    ) {

      showProfileMessage(
        "Username tersebut sudah digunakan pedagang lain.",
        "error"
      );

    } else {

      showProfileMessage(
        "Profil gagal disimpan. Silakan coba lagi.",
        "error"
      );
    }

  } finally {

    saveProfileButton.disabled =
      false;
  }
}


/* ==================================================
   UPLOAD LOCATION
================================================== */

async function uploadLocation(
  position
) {

  if (!currentUser) {
    return;
  }


  const latitude =
    position.coords.latitude;

  const longitude =
    position.coords.longitude;

  const accuracy =
    position.coords.accuracy;


  if (
    lastUploadedLocation
  ) {

    const distance =
      calculateDistance(
        lastUploadedLocation.latitude,
        lastUploadedLocation.longitude,
        latitude,
        longitude
      );


    if (
      distance <
      MIN_LOCATION_UPDATE_DISTANCE_METERS
    ) {

      return;
    }
  }


  const locationRef =
    doc(
      db,
      "vendorLocations",
      currentUser.uid
    );


  try {

    await setDoc(
      locationRef,
      {
        uid:
          currentUser.uid,

        vendorId:
          currentUser.uid,

        latitude,

        longitude,

        accuracy,

        isOnline:
          true,

        isLocationVisible:
          true,

        updatedAt:
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );


    lastUploadedLocation = {
      latitude,
      longitude,
    };


    latitudeElement.textContent =
      latitude.toFixed(
        6
      );

    longitudeElement.textContent =
      longitude.toFixed(
        6
      );

    accuracyElement.textContent =
      `${Math.round(
        accuracy
      )} meter`;


    onlineState.textContent =
      "Online";


    statusDot.classList.add(
      "online"
    );

    statusDot.classList.remove(
      "error"
    );


    locationStatus.textContent =
      "Lokasi sedang dibagikan";


    showLocationMessage(
      "Lokasi berhasil diperbarui.",
      "success"
    );

  } catch (error) {

    console.error(
      "Upload location error:",
      error
    );


    showLocationMessage(
      "Lokasi gagal diperbarui.",
      "error"
    );
  }
}


/* ==================================================
   LOCATION ERROR
================================================== */

function handleLocationError(
  error
) {

  console.error(
    "GPS error:",
    error
  );


  statusDot.classList.remove(
    "online"
  );

  statusDot.classList.add(
    "error"
  );


  onlineState.textContent =
    "Error";


  locationStatus.textContent =
    "Lokasi gagal diperoleh";


  switch (
    error.code
  ) {

    case 1:

      showLocationMessage(
        "Izin lokasi ditolak. Aktifkan izin lokasi untuk browser.",
        "error"
      );

      break;


    case 2:

      showLocationMessage(
        "Lokasi tidak tersedia. Pastikan GPS aktif.",
        "error"
      );

      break;


    case 3:

      showLocationMessage(
        "Permintaan lokasi timeout. Coba lagi.",
        "error"
      );

      break;


    default:

      showLocationMessage(
        "Terjadi kesalahan GPS.",
        "error"
      );
  }
}


/* ==================================================
   START LOCATION
================================================== */

function startLocationSharing() {

  if (!currentUser) {

    showLocationMessage(
      "Sesi login belum siap.",
      "error"
    );

    return;
  }


  if (
    !navigator.geolocation
  ) {

    showLocationMessage(
      "Browser tidak mendukung GPS.",
      "error"
    );

    return;
  }


  if (
    !currentUsername ||
    !businessNameInput.value.trim()
  ) {

    showLocationMessage(
      "Lengkapi profil usaha terlebih dahulu.",
      "error"
    );

    return;
  }


  showLocationMessage(
    "Meminta izin lokasi..."
  );


  watchId =
    navigator.geolocation.watchPosition(
      uploadLocation,
      handleLocationError,
      {
        enableHighAccuracy:
          true,

        maximumAge:
          5000,

        timeout:
          15000,
      }
    );


  startLocationButton.style.display =
    "none";

  stopLocationButton.style.display =
    "block";
}


/* ==================================================
   STOP LOCATION
================================================== */

async function stopLocationSharing() {

  if (
    watchId !== null
  ) {

    navigator.geolocation.clearWatch(
      watchId
    );

    watchId =
      null;
  }


  if (currentUser) {

    try {

      const locationRef =
        doc(
          db,
          "vendorLocations",
          currentUser.uid
        );


      await setDoc(
        locationRef,
        {
          isOnline:
            false,

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );


    } catch (error) {

      console.error(
        "Failed to update offline state:",
        error
      );
    }
  }


  statusDot.classList.remove(
    "online"
  );


  onlineState.textContent =
    "Offline";


  locationStatus.textContent =
    "Lokasi tidak dibagikan";


  showLocationMessage(
    "Berbagi lokasi dihentikan."
  );


  startLocationButton.style.display =
    "block";

  stopLocationButton.style.display =
    "none";


  lastUploadedLocation =
    null;
}


/* ==================================================
   MENU — COLLECTION
================================================== */

function getMenuCollection() {

  return collection(
    db,
    "vendorMenus",
    currentUser.uid,
    "items"
  );
}


/* ==================================================
   LOAD MENUS
================================================== */

async function loadMenus() {

  if (!currentUser) {
    return;
  }


  try {

    const snapshot =
      await getDocs(
        getMenuCollection()
      );


    const menus =
      snapshot.docs.map(
        (documentSnapshot) => ({
          id:
            documentSnapshot.id,

          ...documentSnapshot.data(),
        })
      );


    renderMenus(
      menus
    );

  } catch (error) {

    console.error(
      "Load menus error:",
      error
    );


    showMenuMessage(
      "Menu gagal dimuat.",
      "error"
    );
  }
}


/* ==================================================
   RENDER MENUS
================================================== */

function renderMenus(
  menus
) {

  if (!menuList) {
    return;
  }


  const sortedMenus =
    [...menus].sort(
      (a, b) =>
        (a.name || "").localeCompare(
          b.name || "",
          "id"
        )
    );


  menuCount.textContent =
    `${sortedMenus.length} menu`;


  menuList.innerHTML =
    "";


  if (
    sortedMenus.length === 0
  ) {

    menuList.appendChild(
      menuEmpty
    );

    return;
  }


  sortedMenus.forEach(
    (menu) => {

      const card =
        document.createElement(
          "div"
        );


      card.className =
        "menu-item";


      const header =
        document.createElement(
          "div"
        );


      header.className =
        "menu-item-header";


      const name =
        document.createElement(
          "h3"
        );


      name.textContent =
        menu.name ||
        "Tanpa nama";


      const status =
        document.createElement(
          "span"
        );


      const isAvailable =
        menu.isAvailable === true &&
        Number(menu.stock) > 0;


      status.className =
        isAvailable
          ? "menu-status available"
          : "menu-status unavailable";


      status.textContent =
        isAvailable
          ? "Tersedia"
          : "Tidak tersedia";


      header.appendChild(
        name
      );

      header.appendChild(
        status
      );


      const description =
        document.createElement(
          "p"
        );


      description.textContent =
        menu.description ||
        "Tidak ada deskripsi.";


      const details =
        document.createElement(
          "div"
        );


      details.className =
        "menu-details";


      const price =
        document.createElement(
          "strong"
        );


      price.textContent =
        formatCurrency(
          Number(menu.price) || 0
        );


      const stock =
        document.createElement(
          "span"
        );


      stock.textContent =
        `Stok: ${
          Number(menu.stock) || 0
        }`;


      details.appendChild(
        price
      );

      details.appendChild(
        stock
      );


      const actions =
        document.createElement(
          "div"
        );


      actions.className =
        "menu-actions";


      const editButton =
        document.createElement(
          "button"
        );


      editButton.type =
        "button";

      editButton.className =
        "secondary-button";

      editButton.textContent =
        "Edit";


      editButton.addEventListener(
        "click",
        () =>
          startMenuEdit(
            menu
          )
      );


      const deleteButton =
        document.createElement(
          "button"
        );


      deleteButton.type =
        "button";

      deleteButton.className =
        "secondary-button";

      deleteButton.textContent =
        "Hapus";


      deleteButton.addEventListener(
        "click",
        () =>
          deleteMenu(
            menu.id
          )
      );


      actions.appendChild(
        editButton
      );

      actions.appendChild(
        deleteButton
      );


      card.appendChild(
        header
      );

      card.appendChild(
        description
      );

      card.appendChild(
        details
      );

      card.appendChild(
        actions
      );


      menuList.appendChild(
        card
      );
    }
  );
}


/* ==================================================
   ADD / UPDATE MENU
================================================== */

async function saveMenu() {

  if (!currentUser) {

    showMenuMessage(
      "Sesi login belum siap.",
      "error"
    );

    return;
  }


  const name =
    menuNameInput.value.trim();


  const description =
    menuDescriptionInput.value.trim();


  const price =
    Number(
      menuPriceInput.value
    );


  const stock =
    Number(
      menuStockInput.value
    );


  const isAvailable =
    menuAvailableInput.value ===
    "true";


  if (
    !validateMenuName(
      name
    )
  ) {

    showMenuMessage(
      "Nama produk harus 2–80 karakter.",
      "error"
    );

    return;
  }


  if (
    !validatePrice(
      price
    )
  ) {

    showMenuMessage(
      "Harga tidak valid.",
      "error"
    );

    return;
  }


  if (
    !validateStock(
      stock
    )
  ) {

    showMenuMessage(
      "Stok harus berupa angka 0 atau lebih.",
      "error"
    );

    return;
  }


  saveMenuButton.disabled =
    true;


  showMenuMessage(
    "Menyimpan menu..."
  );


  try {

    const menuId =
      menuIdInput.value;


    const menuData = {

      vendorId:
        currentUser.uid,

      name,

      description,

      price,

      stock,

      isAvailable:
        stock > 0 &&
        isAvailable,

      updatedAt:
        serverTimestamp(),
    };


    if (menuId) {

      const menuRef =
        doc(
          db,
          "vendorMenus",
          currentUser.uid,
          "items",
          menuId
        );


      await setDoc(
        menuRef,
        menuData,
        {
          merge: true,
        }
      );


      showMenuMessage(
        "Menu berhasil diperbarui.",
        "success"
      );

    } else {

      await addDoc(
        getMenuCollection(),
        {
          ...menuData,

          createdAt:
            serverTimestamp(),
        }
      );


      showMenuMessage(
        "Menu berhasil ditambahkan.",
        "success"
      );
    }


    resetMenuForm();

    await loadMenus();

  } catch (error) {

    console.error(
      "Save menu error:",
      error
    );


    showMenuMessage(
      "Menu gagal disimpan.",
      "error"
    );

  } finally {

    saveMenuButton.disabled =
      false;
  }
}


/* ==================================================
   START EDIT
================================================== */

function startMenuEdit(
  menu
) {

  menuIdInput.value =
    menu.id;


  menuNameInput.value =
    menu.name || "";


  menuDescriptionInput.value =
    menu.description || "";


  menuPriceInput.value =
    Number(menu.price) || 0;


  menuStockInput.value =
    Number(menu.stock) || 0;


  menuAvailableInput.value =
    menu.isAvailable === true
      ? "true"
      : "false";


  saveMenuButton.textContent =
    "Simpan Perubahan";


  cancelMenuEditButton.style.display =
    "block";


  menuNameInput.focus();


  showMenuMessage(
    "Mode edit aktif."
  );
}


/* ==================================================
   RESET MENU FORM
================================================== */

function resetMenuForm() {

  menuForm.reset();


  menuIdInput.value =
    "";


  menuAvailableInput.value =
    "true";


  saveMenuButton.textContent =
    "Tambah Menu";


  cancelMenuEditButton.style.display =
    "none";
}


/* ==================================================
   DELETE MENU
================================================== */

async function deleteMenu(
  menuId
) {

  if (!currentUser) {
    return;
  }


  const confirmed =
    window.confirm(
      "Hapus menu ini?"
    );


  if (!confirmed) {
    return;
  }


  try {

    const menuRef =
      doc(
        db,
        "vendorMenus",
        currentUser.uid,
        "items",
        menuId
      );


    await deleteDoc(
      menuRef
    );


    showMenuMessage(
      "Menu berhasil dihapus.",
      "success"
    );


    await loadMenus();

  } catch (error) {

    console.error(
      "Delete menu error:",
      error
    );


    showMenuMessage(
      "Menu gagal dihapus.",
      "error"
    );
  }
}



/* ==================================================
   PESANAN MASUK
================================================== */

const ordersList =
  document.getElementById(
    "ordersList"
  );

const ordersEmpty =
  document.getElementById(
    "ordersEmpty"
  );

const orderCount =
  document.getElementById(
    "orderCount"
  );

const ordersMessage =
  document.getElementById(
    "ordersMessage"
  );

let stopOrdersListener =
  null;


function showOrdersMessage(
  text,
  type = ""
) {
  if (!ordersMessage) {
    return;
  }

  ordersMessage.textContent =
    text;

  ordersMessage.className =
    `message ${type}`;
}


function formatOrderDate(
  timestamp
) {
  if (
    !timestamp ||
    typeof timestamp.toDate !==
      "function"
  ) {
    return "Waktu belum tersedia";
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(
    timestamp.toDate()
  );
}


function getOrderStatusLabel(
  status
) {
  const labels = {
    pending:
      "Menunggu konfirmasi",
    accepted:
      "Diterima",
    rejected:
      "Ditolak",
    completed:
      "Selesai",
  };

  return (
    labels[status] ||
    status ||
    "Tidak diketahui"
  );
}


function getOrderStatusClass(
  status
) {
  return (
    `order-status order-status-${status || "unknown"}`
  );
}


function renderOrders(orders) {
  if (!ordersList) return;

  const activeOrders = orders.filter(
    (order) => order.status === "pending" || order.status === "accepted"
  );
  const historyOrders = orders.filter(
    (order) => order.status === "rejected" || order.status === "completed"
  );

  ordersList.innerHTML = "";
  if (orderCount) orderCount.textContent = activeOrders.length + " aktif";

  if (activeOrders.length === 0) {
    const empty = document.createElement("div");
    empty.className = "menu-empty";
    empty.textContent = "Tidak ada pesanan aktif.";
    ordersList.appendChild(empty);
  } else {
    activeOrders.forEach((order) => ordersList.appendChild(createOrderCard(order, false)));
  }

  renderOrderHistory(historyOrders);
}

function createOrderCard(order, history = false) {
  const card = document.createElement("article");
  card.className = history ? "order-item order-history-item" : "order-item order-active-item";

  const header = document.createElement("div");
  header.className = "order-item-header";

  const title = document.createElement("h3");
  title.textContent = "Pesanan #" + order.id.slice(0, 8);

  const status = document.createElement("span");
  status.className = getOrderStatusClass(order.status);
  status.textContent = getOrderStatusLabel(order.status);

  header.appendChild(title);
  header.appendChild(status);
  card.appendChild(header);

  const time = document.createElement("p");
  time.className = "order-time";
  time.textContent = formatOrderDate(order.createdAt);
  card.appendChild(time);

  const items = document.createElement("div");
  items.className = "order-items";

  (Array.isArray(order.items) ? order.items : []).forEach((item) => {
    const row = document.createElement("div");
    row.className = "order-line";

    const name = document.createElement("span");
    name.textContent = (item.name || "Produk") + " × " + (Number(item.quantity) || 0);

    const price = document.createElement("strong");
    price.textContent = formatCurrency(
      Number(item.subtotal ?? (Number(item.price) * Number(item.quantity))) || 0
    );

    row.appendChild(name);
    row.appendChild(price);
    items.appendChild(row);
  });

  card.appendChild(items);

  const total = document.createElement("div");
  total.className = "order-total";

  const totalLabel = document.createElement("span");
  totalLabel.textContent = "Total";

  const totalValue = document.createElement("strong");
  totalValue.textContent = formatCurrency(Number(order.total) || 0);

  total.appendChild(totalLabel);
  total.appendChild(totalValue);
  card.appendChild(total);

  const detailContent = document.createElement("div");
  detailContent.className = "order-detail-content hidden";

  const payment = document.createElement("p");
  payment.className = "order-detail-row";
  payment.innerHTML = "<span>Pembayaran</span><strong>COD</strong>";
  detailContent.appendChild(payment);

  if (order.deliveryAddress) {
    const address = document.createElement("p");
    address.className = "order-detail-row order-detail-stack";
    address.innerHTML = "<span>Alamat / patokan</span><strong></strong>";
    address.querySelector("strong").textContent = order.deliveryAddress;
    detailContent.appendChild(address);
  }

  if (order.notes) {
    const notes = document.createElement("p");
    notes.className = "order-detail-row order-detail-stack";
    notes.innerHTML = "<span>Catatan</span><strong></strong>";
    notes.querySelector("strong").textContent = order.notes;
    detailContent.appendChild(notes);
  }

  if (order.customerLocation && typeof order.customerLocation.lat === "number" && typeof order.customerLocation.lng === "number") {
    const location = document.createElement("p");
    location.className = "order-detail-row order-detail-stack";
    location.innerHTML = "<span>Lokasi GPS</span><strong></strong>";
    location.querySelector("strong").textContent =
      "📍 " + order.customerLocation.lat.toFixed(6) + ", " + order.customerLocation.lng.toFixed(6);
    detailContent.appendChild(location);
  }

  const detailToggle = document.createElement("button");
  detailToggle.type = "button";
  detailToggle.className = "order-detail-toggle";
  detailToggle.textContent = "Lihat detail";
  detailToggle.addEventListener("click", () => {
    const willOpen = detailContent.classList.contains("hidden");
    detailContent.classList.toggle("hidden", !willOpen);
    detailToggle.textContent = willOpen ? "Tutup detail" : "Lihat detail";
  });

  card.appendChild(detailToggle);
  card.appendChild(detailContent);

  if (!history && order.status === "pending") {
    const actions = document.createElement("div");
    actions.className = "order-actions order-primary-actions";

    const acceptButton = document.createElement("button");
    acceptButton.type = "button";
    acceptButton.className = "primary-button";
    acceptButton.textContent = "Terima";
    acceptButton.addEventListener("click", () => updateOrderStatus(order.id, "accepted"));

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "secondary-button";
    rejectButton.textContent = "Tolak";
    rejectButton.addEventListener("click", () => updateOrderStatus(order.id, "rejected"));

    actions.appendChild(acceptButton);
    actions.appendChild(rejectButton);
    card.appendChild(actions);
  }

  if (!history && order.status === "accepted") {
    const actions = document.createElement("div");
    actions.className = "order-actions";

    const completeButton = document.createElement("button");
    completeButton.type = "button";
    completeButton.className = "primary-button";
    completeButton.textContent = "Selesaikan Pesanan";
    completeButton.addEventListener("click", () => updateOrderStatus(order.id, "completed"));

    actions.appendChild(completeButton);
    card.appendChild(actions);
  }

  return card;
}

function renderOrderHistory(historyOrders) {
  const historyList = document.getElementById("orderHistoryList");
  const historyCount = document.getElementById("orderHistoryCount");

  if (!historyList) return;

  historyList.innerHTML = "";
  if (historyCount) {
    historyCount.textContent = historyOrders.length === 0 ? "Kosong" : historyOrders.length + " pesanan";
  }

  if (historyOrders.length === 0) {
    const empty = document.createElement("div");
    empty.className = "menu-empty";
    empty.textContent = "Belum ada riwayat pesanan.";
    historyList.appendChild(empty);
    return;
  }

  historyOrders.forEach((order) => historyList.appendChild(createOrderCard(order, true)));
}


async function updateOrderStatus(
  orderId,
  status
) {
  if (!currentUser) {
    return;
  }

  const actionLabel =
    status === "accepted"
      ? "menerima"
      : status === "rejected"
        ? "menolak"
        : "menyelesaikan";

  const confirmed =
    window.confirm(
      `Yakin ingin ${actionLabel} pesanan ini?`
    );

  if (!confirmed) {
    return;
  }

  try {
    console.log(
      "[ORDER] Mengirim perubahan status:",
      {
        orderId,
        status,
        vendorId: currentUser.uid,
      }
    );

    showOrdersMessage(
      "Memperbarui status pesanan..."
    );

    const orderRef =
      doc(
        db,
        "orders",
        orderId
      );

    await updateDoc(
      orderRef,
      {
        status,
        updatedAt:
          serverTimestamp(),
      }
    );

    console.log(
      "[ORDER] Status berhasil diperbarui:",
      {
        orderId,
        status,
      }
    );

    showOrdersMessage(
      status === "accepted"
        ? "Pesanan berhasil diterima."
        : status === "rejected"
          ? "Pesanan berhasil ditolak."
          : "Pesanan berhasil diselesaikan.",
      "success"
    );

  } catch (error) {
    console.error(
      "Update order status error:",
      error
    );

    showOrdersMessage(
      "Status pesanan gagal diperbarui.",
      "error"
    );
  }
}


function startOrdersListener() {
  if (
    !currentUser
  ) {
    return;
  }

  if (
    stopOrdersListener
  ) {
    stopOrdersListener();

    stopOrdersListener =
      null;
  }

  const ordersQuery =
    query(
      collection(
        db,
        "orders"
      ),
      where(
        "vendorId",
        "==",
        currentUser.uid
      )
    );

  stopOrdersListener =
    onSnapshot(
      ordersQuery,
      (snapshot) => {
        const orders =
          snapshot.docs
            .map(
              (orderDoc) => ({
                id:
                  orderDoc.id,
                ...orderDoc.data(),
              })
            )
            .sort(
              (a, b) => {
                const aTime =
                  a.createdAt?.toMillis?.() ||
                  0;

                const bTime =
                  b.createdAt?.toMillis?.() ||
                  0;

                return (
                  bTime - aTime
                );
              }
            );

        renderOrders(
          orders
        );
      },
      (error) => {
        console.error(
          "Orders listener error:",
          error
        );

        showOrdersMessage(
          "Pesanan gagal dimuat.",
          "error"
        );
      }
    );
}




/* ==================================================
   LOGOUT
================================================== */

async function logoutVendor() {
  if (!logoutButton) {
    return;
  }

  const confirmed =
    window.confirm(
      "Yakin ingin keluar dari akun Mitra?"
    );

  if (!confirmed) {
    return;
  }

  logoutButton.disabled = true;
  logoutButton.textContent = "Keluar...";

  try {
    console.log("[AUTH] Logout Mitra dimulai.");

    if (watchId !== null) {
      await stopLocationSharing();
    }

    await signOut(auth);

    console.log(
      "[AUTH] Logout berhasil. Session Firebase dihapus."
    );

    window.location.replace(
      "login-vendor.html"
    );
  } catch (error) {
    console.error(
      "[AUTH] Logout gagal:",
      error
    );

    logoutButton.disabled = false;
    logoutButton.textContent = "Keluar";

    alert(
      "Logout gagal. Silakan coba lagi."
    );
  }
}


/* ==================================================
   AUTHENTICATION
================================================== */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      window.location.replace(
        "login-vendor.html"
      );

      return;
    }


    currentUser =
      user;


    try {

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

        showProfileMessage(
          "Profil akun tidak ditemukan.",
          "error"
        );

        return;
      }


      const profile =
        userSnapshot.data();


      if (
        profile.role !==
        "vendor"
      ) {

        showProfileMessage(
          "Akun ini bukan akun Mitra Pedagang.",
          "error"
        );

        return;
      }


      await loadVendorProfile();

      await loadMenus();

      startOrdersListener();

    } catch (error) {

      console.error(
        "Vendor authentication error:",
        error
      );


      showProfileMessage(
        "Gagal memuat profil Mitra.",
        "error"
      );
    }
  }
);


/* ==================================================
   EVENT LISTENERS
================================================== */


if (
  logoutButton
) {

  logoutButton.addEventListener(
    "click",
    logoutVendor
  );
}


if (
  businessProfileForm
) {

  businessProfileForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      await saveVendorProfile();
    }
  );
}


if (
  startLocationButton
) {

  startLocationButton.addEventListener(
    "click",
    startLocationSharing
  );
}


if (
  stopLocationButton
) {

  stopLocationButton.addEventListener(
    "click",
    stopLocationSharing
  );
}


if (
  menuForm
) {

  menuForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      await saveMenu();
    }
  );
}


if (
  cancelMenuEditButton
) {

  cancelMenuEditButton.addEventListener(
    "click",
    () => {

      resetMenuForm();

      showMenuMessage(
        "Edit dibatalkan."
      );
    }
  );
}

document.addEventListener("click", (event) => {
  const topButton = event.target.closest('[data-quick-action="top"]');
  if (topButton) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const toggle = event.target.closest("#toggleOrderHistory");
  if (!toggle) return;

  const content = document.getElementById("orderHistoryContent");
  const chevron = document.getElementById("orderHistoryChevron");

  if (!content) return;

  const willOpen = content.classList.contains("hidden");
  content.classList.toggle("hidden", !willOpen);
  toggle.setAttribute("aria-expanded", String(willOpen));

  if (chevron) {
    chevron.textContent = willOpen ? "⌃" : "⌄";
  }
});
