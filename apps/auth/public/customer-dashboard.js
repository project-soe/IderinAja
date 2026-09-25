/**
 * ==================================================
 * IDERINAJA — CUSTOMER DASHBOARD
 * ==================================================
 *
 * Responsibilities:
 * - Authenticate customer.
 * - Verify customer role.
 * - Track customer's GPS position.
 * - Display vendor locations.
 * - Search vendor by:
 *      1. Business name
 *      2. Username
 *      3. Category
 * - Display vendor public profile.
 * - Create customer → vendor subscriptions.
 *
 * IMPORTANT:
 * Live-location access is NOT yet restricted by
 * subscription at this stage.
 *
 * The existing GPS mechanism is intentionally
 * preserved so the current working MVP remains
 * stable.
 *
 * Future architecture:
 *
 * Customer
 *    ↓
 * Search vendor
 *    ↓
 * Vendor profile
 *    ↓
 * Subscribe
 *    ↓
 * Authorized live location
 *
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
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
console.log("[BOOT] customer-dashboard.js BERHASIL DIEKSEKUSI");

/* ==================================================
   FIREBASE
================================================== */

const auth = getAuth(firebaseApp);

const db = firestoreDb;

/* ==================================================
   DOM REFERENCES
================================================== */

const dashboard =
  document.getElementById("dashboard");

const loading =
  document.getElementById("loading");
console.log("[BOOT] customer-dashboard.js mulai dieksekusi.");

loading.querySelector(".empty").textContent =
  "BOOT: JavaScript berhasil dijalankan.";

const errorScreen =
  document.getElementById("error");

const errorMessage =
  document.getElementById("errorMessage");

const vendorList =
  document.getElementById("vendorList");

const connectionStatus =
  document.getElementById("connectionStatus");

/* Search */

const vendorSearch =
  document.getElementById("vendorSearch");

const categoryFilter =
  document.getElementById("categoryFilter");

const searchResultCount =
  document.getElementById("searchResultCount");

/* Modal */

const vendorModal =
  document.getElementById("vendorModal");

const closeVendorModal =
  document.getElementById("closeVendorModal");

const modalVendorName =
  document.getElementById("modalVendorName");

const modalVendorUsername =
  document.getElementById("modalVendorUsername");

const modalVendorCategory =
  document.getElementById("modalVendorCategory");

const subscribeButton =
  document.getElementById("subscribeButton");

/* ==================================================
   APPLICATION STATE
================================================== */

let currentUser = null;

let map = null;

let customerMarker = null;

let customerPosition = null;

let vendorMarkers = new Map();

let stopVendorListener = null;
let vendorLocationListeners = new Map();
let vendorProximityState = new Map();
let notificationServiceWorkerRegistration = null;

let watchId = null;

/**
 * All vendor profiles currently available
 * from Firestore.
 */
let allVendors = [];

/**
 * Currently selected category.
 */
let selectedCategory = "all";

/**
 * Vendor currently displayed in profile modal.
 */
let selectedVendor = null;

let cart = {
  vendorId: null,
  vendorName: "",
  items: [],
};

/**
 * IDs of vendors subscribed by the customer.
 */
let subscribedVendorIds = new Set();
let stopCustomerOrdersListener = null;

/* ==================================================
   MAP ICONS
================================================== */

const vendorIcon = L.divIcon({
  className:
    "iderinaja-vendor-marker",

  html: `
    <div style="
      width: 38px;
      height: 38px;
      border-radius: 50% 50% 50% 0;
      background: #ffc21a;
      border: 3px solid #ffffff;
      box-shadow: 0 3px 12px rgba(0,0,0,0.35);
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="
        transform: rotate(45deg);
        font-size: 18px;
      ">🛒</span>
    </div>
  `,

  iconSize: [38, 38],

  iconAnchor: [19, 38],

  popupAnchor: [0, -38],
});

const customerIcon = L.divIcon({
  className:
    "iderinaja-customer-marker",

  html: `
    <div style="
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #168cff;
      border: 4px solid #ffffff;
      box-shadow: 0 3px 14px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 17px;
    ">
      ●
    </div>
  `,

  iconSize: [34, 34],

  iconAnchor: [17, 17],

  popupAnchor: [0, -17],
});

/* ==================================================
   ERROR HANDLING
================================================== */

function showError(message) {
  loading.classList.add("hidden");

  dashboard.classList.add("hidden");

  errorScreen.classList.remove("hidden");

  errorMessage.textContent =
    message;
}

/* ==================================================
   LOGOUT
================================================== */

const logoutButton =
  document.getElementById(
    "logoutButton"
  );

logoutButton?.addEventListener(
  "click",
  async () => {
    try {
      logoutButton.disabled = true;
      logoutButton.textContent =
        "Keluar...";

      await signOut(auth);

      window.location.replace(
        "login-customer.html"
      );

    } catch (error) {
      console.error(
        "[LOGOUT ERROR]",
        error
      );

      logoutButton.disabled = false;
      logoutButton.textContent =
        "Keluar";

      showError(
        "Gagal keluar dari akun: " +
        (
          error?.message ||
          "Kesalahan tidak diketahui"
        )
      );
    }
  }
);

/* ==================================================
   DISTANCE
   Haversine formula
================================================== */

function calculateDistance(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  const earthRadius = 6371000;

  const toRadians =
    (degrees) =>
      degrees * Math.PI / 180;

  const deltaLatitude =
    toRadians(
      latitude2 - latitude1
    );

  const deltaLongitude =
    toRadians(
      longitude2 - longitude1
    );

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
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

  return earthRadius * c;
}

/* ==================================================
   FORMAT DISTANCE
================================================== */

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(
    meters / 1000
  ).toFixed(2)} km`;
}

/* ==================================================
   NORMALIZATION
================================================== */

/**
 * Normalize search text.
 *
 * Example:
 * " @BangUdin "
 * → "bangudin"
 */
function normalizeSearchText(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}

/**
 * Normalize category.
 */
function normalizeCategory(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/* ==================================================
   MAP
================================================== */

function initializeMap() {
  const mapElement =
    document.getElementById("map");

  if (!mapElement) {
    console.error(
      "[MAP] Element #map tidak ditemukan."
    );
    return;
  }

  // Map JavaScript sudah ada
  if (map) {
    console.log(
      "[MAP] Instance map sudah tersedia."
    );
    return;
  }

  // Container sudah pernah dipakai Leaflet
  if (mapElement._leaflet_id) {
    console.warn(
      "[MAP] Container sudah diinisialisasi Leaflet."
    );
    return;
  }

  console.log(
    "[MAP] Membuat instance Leaflet baru."
  );

  map = L.map(
    mapElement
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        "&copy; OpenStreetMap contributors",
    }
  ).addTo(map);

  map.setView(
    [-2.5, 118],
    5
  );

  console.log(
    "[MAP] Leaflet berhasil diinisialisasi."
  );
}

/* ==================================================
   CUSTOMER GPS
================================================== */

function startCustomerLocation() {
  if (!navigator.geolocation) {
    connectionStatus.textContent =
      "GPS tidak didukung browser";

    return;
  }

  watchId =
    navigator.geolocation.watchPosition(
      (position) => {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const accuracy =
          position.coords.accuracy;

        customerPosition = {
          latitude,
          longitude,
          accuracy,
        };
        updateCheckoutLocationUI();

        const location = [
          latitude,
          longitude,
        ];

        if (!customerMarker) {
          customerMarker =
            L.marker(
              location,
              {
                icon:
                  customerIcon,
              }
            )
              .addTo(map)
              .bindPopup(
                "<b>Posisi Anda</b>"
              );
        } else {
          customerMarker.setLatLng(
            location
          );
        }

        map.setView(
          location,
          15
        );

        updateVendorDistances();

        renderVendorResults();

        // Re-evaluasi semua Mitra yang dilanggan setiap kali
        // posisi Konsumen berubah. Ini penting agar notifikasi
        // tetap bekerja walaupun Mitra sedang diam.
        checkAllNearbyVendorNotifications();

        console.log(
          "Customer GPS:",
          customerPosition
        );
      },

      (error) => {
        console.error(
          "Customer GPS error:",
          error
        );

        connectionStatus.textContent =
          "GPS Konsumen belum aktif";
      },

      {
        enableHighAccuracy: true,

        maximumAge: 5000,

        timeout: 15000,
      }
    );
}

/* ==================================================
   UPDATE DISTANCES
================================================== */

function updateVendorDistances() {
  if (!customerPosition) {
    return;
  }

  document
    .querySelectorAll(
      "[data-vendor-id]"
    )
    .forEach((element) => {
      const latitude =
        Number(
          element.dataset.latitude
        );

      const longitude =
        Number(
          element.dataset.longitude
        );

      const distance =
        calculateDistance(
          customerPosition.latitude,
          customerPosition.longitude,
          latitude,
          longitude
        );

      const distanceElement =
        element.querySelector(
          ".distance"
        );

      if (distanceElement) {
        distanceElement.textContent =
          formatDistance(
            distance
          );
      }
    });

  vendorMarkers.forEach(
    (markerData) => {
      const distance =
        calculateDistance(
          customerPosition.latitude,
          customerPosition.longitude,
          markerData.latitude,
          markerData.longitude
        );

      markerData.marker.setPopupContent(`
        <b>${escapeHtml(
          markerData.businessName ||
            "Mitra IderinAja"
        )}</b><br>
        Jarak:
        ${formatDistance(distance)}
      `);
    }
  );
}

/* ==================================================
   ESCAPE HTML
================================================== */

/**
 * Prevent vendor profile text from being
 * interpreted as HTML.
 */
function escapeHtml(value) {
  return String(value || "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

/* ==================================================
   VENDOR SEARCH
================================================== */

function getFilteredVendors() {
  const search =
    normalizeSearchText(
      vendorSearch?.value || ""
    );

  return allVendors.filter(
    (vendor) => {
      const username =
        normalizeSearchText(
          vendor.username || ""
        );

      const businessName =
        String(
          vendor.businessName || ""
        )
          .trim()
          .toLowerCase();

      const category =
        normalizeCategory(
          vendor.category
        );

      /* ------------------------------------------
         Category filter
      ------------------------------------------ */

      if (
        selectedCategory !==
          "all" &&
        category !==
          selectedCategory
      ) {
        return false;
      }

      /* ------------------------------------------
         Empty search = show all
      ------------------------------------------ */

      if (!search) {
        return true;
      }

      /* ------------------------------------------
         Username / business name search
      ------------------------------------------ */

      return (
        username.includes(search) ||
        businessName.includes(search)
      );
    }
  );
}

/* ==================================================
   SORT VENDORS
================================================== */

function sortVendorsByDistance(
  vendors
) {
  return [...vendors].sort(
    (a, b) => {
      if (!customerPosition) {
        return (
          String(
            a.businessName || ""
          ).localeCompare(
            String(
              b.businessName || ""
            )
          )
        );
      }

      const distanceA =
        calculateDistance(
          customerPosition.latitude,
          customerPosition.longitude,
          a.latitude,
          a.longitude
        );

      const distanceB =
        calculateDistance(
          customerPosition.latitude,
          customerPosition.longitude,
          b.latitude,
          b.longitude
        );

      return (
        distanceA - distanceB
      );
    }
  );
}

/* ==================================================
   RENDER SEARCH RESULTS
================================================== */

function renderVendorResults() {
  const filtered =
    getFilteredVendors();

  const sorted =
    sortVendorsByDistance(
      filtered
    );

  searchResultCount.textContent =
    `${sorted.length} pedagang ditemukan`;

  if (sorted.length === 0) {
    vendorList.innerHTML = `
      <div class="empty">
        Tidak ada pedagang yang sesuai
        dengan pencarian.
      </div>
    `;

    return;
  }

  vendorList.innerHTML = "";

  sorted.forEach(
    (vendor) => {
      const element =
        document.createElement(
          "div"
        );

      element.className =
        "vendor";

      element.dataset.vendorId =
        vendor.id;

      element.dataset.latitude =
        vendor.latitude;

      element.dataset.longitude =
        vendor.longitude;

      let distanceText =
        "Lokasi belum tersedia";

      if (
        customerPosition &&
        typeof vendor.latitude ===
          "number" &&
        typeof vendor.longitude ===
          "number"
      ) {
        const distance =
          calculateDistance(
            customerPosition.latitude,
            customerPosition.longitude,
            vendor.latitude,
            vendor.longitude
          );

        distanceText =
          formatDistance(
            distance
          );
      }

      const businessName =
        vendor.businessName ||
        "Mitra IderinAja";

      const username =
        vendor.username
          ? `@${vendor.username}`
          : "Username belum tersedia";

      const category =
        vendor.category ||
        "Lainnya";

      const subscribed =
        subscribedVendorIds.has(
          vendor.id
        );

      element.innerHTML = `
        <div class="vendor-header">

          <div>

            <div class="vendor-name">
              ${escapeHtml(
                businessName
              )}
            </div>

            <div class="vendor-username">
              ${escapeHtml(
                username
              )}
            </div>

          </div>

          <div class="distance">
            ${escapeHtml(
              distanceText
            )}
          </div>

        </div>

        <div class="vendor-category">
          ${escapeHtml(
            category
          )}
        </div>

        <div class="vendor-info">

          <div>
            ${
              vendor.isOnline === true
                ? "🟢 Pedagang sedang online"
                : "⚪ Pedagang sedang offline"
            }
          </div>

        </div>

        <div class="vendor-actions">

          <button
            type="button"
            class="vendor-button primary"
            data-action="profile"
            data-vendor-id="${escapeHtml(
              vendor.id
            )}"
          >
            Lihat Profil
          </button>

          <button
            type="button"
            class="vendor-button ${
              subscribed
                ? "subscribed"
                : ""
            }"
            data-action="${
              subscribed
                ? "unsubscribe"
                : "subscribe"
            }"
            data-vendor-id="${escapeHtml(
              vendor.id
            )}"
          >
            ${
              subscribed
                ? "✓ Berlangganan"
                : "⭐ Subscribe"
            }
          </button>

        </div>
      `;

      vendorList.appendChild(
        element
      );
    }
  );

  updateVendorDistances();
}

/* ==================================================
   MAP MARKERS
================================================== */

function updateVendorMarkers(
  vendors
) {
  /**
   * Map only displays vendors who are
   * currently online and have valid GPS.
   */
  const onlineVendors =
    vendors.filter(
      (vendor) =>
        vendor.isOnline === true &&
        typeof vendor.latitude ===
          "number" &&
        typeof vendor.longitude ===
          "number"
    );

  const currentIds =
    new Set(
      onlineVendors.map(
        (vendor) =>
          vendor.id
      )
    );

  /* ----------------------------------------------
     Remove old markers.
  ---------------------------------------------- */

  vendorMarkers.forEach(
    (markerData, id) => {
      if (
        !currentIds.has(id)
      ) {
        map.removeLayer(
          markerData.marker
        );

        vendorMarkers.delete(
          id
        );
      }
    }
  );

  /* ----------------------------------------------
     Create / update markers.
  ---------------------------------------------- */

  onlineVendors.forEach(
    (vendor) => {
      const location = [
        vendor.latitude,
        vendor.longitude,
      ];

      const existing =
        vendorMarkers.get(
          vendor.id
        );

      if (existing) {
        existing.marker.setLatLng(
          location
        );

        existing.latitude =
          vendor.latitude;

        existing.longitude =
          vendor.longitude;

        existing.accuracy =
          vendor.accuracy;

        existing.businessName =
          vendor.businessName;

        return;
      }

      const marker =
        L.marker(
          location,
          {
            icon:
              vendorIcon,
          }
        ).addTo(map);

      marker.bindPopup(`
        <b>${escapeHtml(
          vendor.businessName ||
            "Mitra IderinAja"
        )}</b><br>
        Menghitung jarak...
      `);

      vendorMarkers.set(
        vendor.id,
        {
          marker,
          latitude:
            vendor.latitude,
          longitude:
            vendor.longitude,
          accuracy:
            vendor.accuracy,
          businessName:
            vendor.businessName,
        }
      );
    }
  );

  updateVendorDistances();
}

/* ==================================================
   LOAD SUBSCRIPTIONS
================================================== */

/**
 * Load the customer's current subscriptions.
 *
 * Subscription document ID:
 *
 * customerId_vendorId
 *
 * Example:
 *
 * abc123_vendor456
 */
async function loadSubscriptions() {
  if (!currentUser) {
    return;
  }

  /**
   * At this MVP stage we load subscription
   * state individually for displayed vendors.
   *
   * This will later be replaced by a
   * dedicated subscription listener/query.
   */
  subscribedVendorIds =
    new Set();

  for (
    const vendor of allVendors
  ) {
    const subscriptionId =
      `${currentUser.uid}_${vendor.id}`;

    const subscriptionRef =
      doc(
        db,
        "subscriptions",
        subscriptionId
      );

    try {
      const snapshot =
        await getDoc(
          subscriptionRef
        );

      if (
        snapshot.exists() &&
        snapshot.data().active === true
      ) {
        subscribedVendorIds.add(
          vendor.id
        );
      }
    } catch (error) {
      console.error(
        "Subscription lookup error:",
        error
      );
    }
  }
}

/* ==================================================
   SUBSCRIBE
================================================== */

async function subscribeToVendor(
  vendor
) {
  if (!currentUser) {
    return;
  }

  if (!vendor) {
    return;
  }

  const subscriptionId =
    `${currentUser.uid}_${vendor.id}`;

  const subscriptionRef =
    doc(
      db,
      "subscriptions",
      subscriptionId
    );

  try {
    subscribeButton.disabled =
      true;

    subscribeButton.textContent =
      "Menyimpan...";

    await setDoc(
      subscriptionRef,
      {
        customerId:
          currentUser.uid,

        vendorId:
          vendor.id,

        active: true,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    subscribedVendorIds.add(
      vendor.id
    );

    syncVendorLocationListeners();

    updateSubscribeButton();

    renderVendorResults();

    console.log(
      "Vendor subscribed:",
      {
        customerId:
          currentUser.uid,
        vendorId:
          vendor.id,
      }
    );
  } catch (error) {
    console.error(
      "Subscribe error:",
      error
    );

    subscribeButton.disabled =
      false;

    subscribeButton.textContent =
      "⭐ Berlangganan";

    alert(
      "Gagal berlangganan pedagang. Pastikan aturan Firestore subscriptions sudah diperbarui."
    );
  }
}

/* ==================================================
   UNSUBSCRIBE
================================================== */

async function unsubscribeFromVendor(
  vendor
) {
  if (!currentUser) {
    return;
  }

  if (!vendor) {
    return;
  }
  console.log(
  "[UNSUB DEBUG] Mulai unsubscribe:",
  {
    customerId: currentUser?.uid,
    vendorId: vendor?.id,
    vendorName: vendor?.businessName,
  }
);

  const confirmed =
    window.confirm(
      `Berhenti berlangganan dari ${
        vendor.businessName ||
        "pedagang ini"
      }? Anda tidak akan lagi menerima notifikasi dari mitra ini.`
    );

  if (!confirmed) {
    return;
  }

  const subscriptionId =
    `${currentUser.uid}_${vendor.id}`;

  const subscriptionRef =
    doc(
      db,
      "subscriptions",
      subscriptionId
    );

  const isModalOpen =
    selectedVendor?.id ===
    vendor.id;

  try {
    if (isModalOpen) {
      subscribeButton.disabled =
        true;

      subscribeButton.textContent =
        "Membatalkan...";
    }
    console.log(
  "[UNSUB DEBUG] Akan menghapus:",
  subscriptionId
);
    /*
     * Hapus dokumen subscription.
     *
     * ID dokumen:
     * customerUID_vendorUID
     *
     * Ini benar-benar menghapus status
     * berlangganan customer terhadap vendor.
     */
    await deleteDoc(
      subscriptionRef
    );
    console.log(
  "[UNSUB DEBUG] deleteDoc BERHASIL:",
  subscriptionId
);

console.log(
  "[UNSUB DEBUG] State sebelum delete:",
  subscribedVendorIds.has(
    vendor.id
  )
);
    /*
     * Update state lokal.
     */
    subscribedVendorIds.delete(
      vendor.id
    );

    syncVendorLocationListeners();

    console.log(
  "[UNSUB DEBUG] State setelah delete:",
  subscribedVendorIds.has(
    vendor.id
  )
);

    /*
     * Update tombol pada modal.
     */
    if (isModalOpen) {
      updateSubscribeButton();
    }

    /*
     * Render ulang daftar vendor agar
     * tombol berubah menjadi Subscribe.
     */
    renderVendorResults();

    console.log(
      "Vendor unsubscribed:",
      {
        customerId:
          currentUser.uid,

        vendorId:
          vendor.id,
      }
    );

  } catch (error) {
    console.error(
      "Unsubscribe error:",
      error
    );

    if (isModalOpen) {
      subscribeButton.disabled =
        false;

      updateSubscribeButton();
    }

    alert(
      "Gagal berhenti berlangganan. Silakan coba lagi."
    );
  }
}
/* ==================================================
   SUBSCRIBE BUTTON
================================================== */

function updateSubscribeButton() {
  if (!selectedVendor) {
    return;
  }

  const subscribed =
    subscribedVendorIds.has(
      selectedVendor.id
    );

  subscribeButton.disabled =
    false;

  if (subscribed) {
    subscribeButton.textContent =
      "✕ Berhenti Berlangganan";

    subscribeButton.classList.add(
      "subscribed"
    );

    return;
  }

  subscribeButton.textContent =
    "⭐ Berlangganan";

  subscribeButton.classList.remove(
    "subscribed"
  );
}

/* ==================================================
   VENDOR MENU
================================================== */

async function loadVendorMenus(
  vendorId
) {
  const menuContainer =
    document.getElementById(
      "modalVendorMenu"
    );

  if (!menuContainer) {
    return;
  }

  menuContainer.innerHTML = `
    <div class="vendor-menu-title">
      Menu
    </div>

    <div class="vendor-menu-loading">
      Memuat menu...
    </div>
  `;

  try {
    const menuRef =
      collection(
        db,
        "vendorMenus",
        vendorId,
        "items"
      );

    const snapshot =
      await getDocs(
        menuRef
      );

    const menus =
      snapshot.docs.map(
        (menuSnapshot) => ({
          id:
            menuSnapshot.id,
          ...menuSnapshot.data(),
        })
      );

    renderVendorMenus(
      menus
    );
  } catch (error) {
    console.error(
      "Load vendor menus error:",
      error
    );

    menuContainer.innerHTML = `
      <div class="vendor-menu-title">
        Menu
      </div>

      <div class="vendor-menu-error">
        Menu belum dapat dimuat.
      </div>
    `;
  }
}

function renderVendorMenus(
  menus
) {
  const menuContainer =
    document.getElementById(
      "modalVendorMenu"
    );

  if (!menuContainer) {
    return;
  }

  if (
    !menus ||
    menus.length === 0
  ) {
    menuContainer.innerHTML = `
      <div class="vendor-menu-title">
        Menu
      </div>

      <div class="vendor-menu-empty">
        Mitra ini belum memiliki menu.
      </div>
    `;

    return;
  }

  const sortedMenus =
    [...menus].sort(
      (a, b) =>
        String(
          a.name || ""
        ).localeCompare(
          String(
            b.name || ""
          ),
          "id"
        )
    );

  menuContainer.innerHTML = `
    <div class="vendor-menu-title">
      Menu Pedagang
    </div>

    <div class="vendor-menu-list">

      ${sortedMenus
        .map((menu) => {
          const stock =
            Number(
              menu.stock
            ) || 0;

          const available =
            menu.isAvailable === true &&
            stock > 0;

          const price =
            formatRupiah(
              menu.price
            );

          return `
            <article
              class="vendor-menu-item ${
                available
                  ? ""
                  : "unavailable"
              }"
            >

              <div class="vendor-menu-main">

                <div class="vendor-menu-name">
                  ${escapeHtml(
                    menu.name ||
                      "Tanpa nama"
                  )}
                </div>

                <div class="vendor-menu-description">
                  ${escapeHtml(
                    menu.description ||
                      "Tidak ada deskripsi."
                  )}
                </div>

              </div>

              <div class="vendor-menu-bottom">

                <div class="vendor-menu-meta">

                  <div class="vendor-menu-price">
                    ${price}
                  </div>

                  <div class="vendor-menu-stock">
                    ${
                      stock > 0
                        ? `Stok ${stock}`
                        : "Stok habis"
                    }
                  </div>

                </div>

                <div
                  class="vendor-menu-status ${
                    available
                      ? "available"
                      : "unavailable"
                  }"
                >
                  ${
                    available
                      ? "Tersedia"
                      : "Habis"
                  }
                </div>

              </div>


              ${
                available
                  ? `
                    <div class="vendor-menu-cart-controls">

                      <div class="vendor-menu-quantity">
                       <button
                          type="button"
                          class="quantity-button menu-minus"
                          data-menu-id="${menu.id}"
                        >
                          −
                        </button>

                        <span
                          class="quantity-value"
                        >
                          0
                        </span>

                        <button
                          type="button"
                          class="quantity-button menu-plus"
                          data-menu-id="${menu.id}"
                        >
                          +
                        </button>

                      </div>

                      <button
                        type="button"
                        class="add-cart-button"
                        data-menu-id="${menu.id}"
                      >
                        Tambah ke keranjang
                      </button>

                    </div>
                  `
                  : ""
              }
            </article>
          `;
        })
        .join("")}

    </div>
  `;
}

/* =========================================
   CART MVP
========================================= */

function getCartItem(menuId) {
  return cart.items.find(
    (item) => item.menuId === menuId
  );
}

function getCartItemCount() {
  return cart.items.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );
}

function getCartTotal() {
  return cart.items.reduce(
    (total, item) =>
      total +
      Number(item.price || 0) *
      item.quantity,
    0
  );
}
function updateCartUI() {

  const cartBar =
    document.getElementById("cartBar");

  const cartBarTitle =
    document.getElementById("cartBarTitle");

  const cartBarSummary =
    document.getElementById("cartBarSummary");

  const cartItems =
    document.getElementById("cartItems");

  const cartVendorName =
    document.getElementById("cartVendorName");

  const cartTotal =
    document.getElementById("cartTotal");

  if (!cartBar) return;

  const itemCount =
    getCartItemCount();

  const total =
    getCartTotal();

  if (itemCount === 0) {

    cartBar.classList.add("hidden");

  } else {

    cartBar.classList.remove("hidden");

    if (cartBarTitle) {
      cartBarTitle.textContent =
        `🛒 ${itemCount} item`;
    }

    if (cartBarSummary) {
      cartBarSummary.textContent =
        `${cart.vendorName || "Mitra"} • ${formatRupiah(total)}`;
    }
  }

  if (cartVendorName) {
    cartVendorName.textContent =
      cart.vendorName || "Mitra";
  }

  if (cartTotal) {
    cartTotal.textContent =
      formatRupiah(total);
  }

  if (cartItems) {
    renderCartItems();
  }

  updateMenuCartControls();
}

function renderCartItems() {

  const container =
    document.getElementById("cartItems");

  if (!container) return;

  if (cart.items.length === 0) {

    container.innerHTML = `
      <div class="cart-empty">
        Keranjang masih kosong.
      </div>
    `;

    return;
  }

  container.innerHTML =
    cart.items
      .map((item) => {

        const itemTotal =
          Number(item.price || 0) *
          item.quantity;

        return `
          <article class="cart-item">

            <div class="cart-item-top">

              <div class="cart-item-name">
                ${escapeHtml(item.name || "Menu")}
              </div>

              <div class="cart-item-price">
                ${formatRupiah(item.price)}
              </div>

            </div>

            <div class="cart-item-bottom">

              <div class="vendor-menu-quantity">

                <button
                  type="button"
                  class="quantity-button cart-minus"
                  data-menu-id="${item.menuId}"
                >
                  −
                </button>

                <span class="quantity-value">
                  ${item.quantity}
                </span>
                <span class="quantity-value">
                  ${item.quantity}
                </span>

                <button
                  type="button"
                  class="quantity-button cart-plus"
                  data-menu-id="${item.menuId}"
                  ${
                    item.quantity >= item.stock
                      ? "disabled"
                      : ""
                  }
                >
                  +
                </button>

              </div>

              <div class="cart-item-total">
                ${formatRupiah(itemTotal)}
              </div>

              <button
                type="button"
                class="cart-remove"
                data-menu-id="${item.menuId}"
              >
                Hapus
              </button>

            </div>

          </article>
        `;
      })
      .join("");
}

function updateMenuCartControls() {

  document
    .querySelectorAll(".vendor-menu-item")
    .forEach((element) => {

      const addButton =
        element.querySelector(
          ".add-cart-button"
        );

      if (!addButton) return;

      const menuId =
        addButton.dataset.menuId;

      const item =
        getCartItem(menuId);

      const quantity =
        item ? item.quantity : 0;

      const minus =
        element.querySelector(
          ".menu-minus"
        );

      const plus =
        element.querySelector(
          ".menu-plus"
        );

      const quantityValue =
        element.querySelector(
          ".quantity-value"
        );

      if (quantityValue) {
        quantityValue.textContent =
          quantity;
      }

      if (minus) {
        minus.disabled =
          quantity <= 0;
      }

      if (plus) {
        plus.disabled =
          !item ||
          quantity >= Number(item.stock || 0);
      }

      addButton.textContent =
        item
          ? "Tambah lagi"
          : "Tambah ke keranjang";
    });
}

function addToCart(vendor, menu) {

  if (!vendor || !menu) return;

  const stock =
    Number(menu.stock) || 0;

  if (
    menu.isAvailable !== true ||
    stock <= 0
  ) {

    alert(
      "Menu ini sedang tidak tersedia."
    );

    return;
  }
  if (
    cart.vendorId &&
    cart.vendorId !== vendor.id &&
    cart.items.length > 0
  ) {

    const confirmed =
      window.confirm(
        `Keranjang berisi pesanan dari ${
          cart.vendorName || "mitra lain"
        }.

Kosongkan keranjang dan mulai pesanan dari ${
          vendor.businessName ||
          vendor.username ||
          "mitra ini"
        }?`
      );

    if (!confirmed) return;

    clearCart();
  }

  if (!cart.vendorId) {

    cart.vendorId =
      vendor.id;

    cart.vendorName =
      vendor.businessName ||
      vendor.username ||
      "Mitra";
  }

  let item =
    getCartItem(menu.id);

  if (!item) {

    item = {
      menuId: menu.id,
      name:
        menu.name ||
        "Tanpa nama",
      price:
        Number(menu.price) || 0,
      quantity: 1,
      stock,
    };

    cart.items.push(item);

  } else {

    if (
      item.quantity >= stock
    ) {

      alert(
        `Stok ${menu.name || "menu ini"} hanya ${stock}.`
      );

      return;
    }

    item.quantity += 1;
    item.stock = stock;
  }

  updateCartUI();
}

function changeCartQuantity(
  menuId,
  change
) {

  const item =
    getCartItem(menuId);

  if (!item) return;

  const next =
    item.quantity + change;

  if (next <= 0) {

    removeCartItem(menuId);

    return;
  }

  if (next > item.stock) {

    alert(
      `Stok tersedia hanya ${item.stock}.`
    );

    return;
  }

  item.quantity =
    next;

  updateCartUI();
}

function removeCartItem(menuId) {

  cart.items =
    cart.items.filter(
      (item) =>
        item.menuId !== menuId
    );

  if (
    cart.items.length === 0
  ) {

    cart.vendorId = null;
    cart.vendorName = "";

    closeCartModal();
  }

  updateCartUI();
}
function clearCart() {

  cart = {
    vendorId: null,
    vendorName: "",
    items: [],
  };

  updateCartUI();
}

function openCartModal() {

  const modal =
    document.getElementById(
      "cartModal"
    );

  if (!modal) return;

  updateCartUI();

  modal.classList.remove(
    "hidden"
  );
}

function closeCartModal() {

  const modal =
    document.getElementById(
      "cartModal"
    );

  if (!modal) return;

  modal.classList.add(
    "hidden"
  );
}

function renderCheckoutItems() {

  const container =
    document.getElementById(
      "checkoutItems"
    );

  if (!container) {
    return;
  }

  if (!cart.items.length) {

    container.innerHTML = `
      <div class="cart-empty">
        Keranjang masih kosong.
      </div>
    `;

    return;
  }

  container.innerHTML =
    cart.items
      .map((item) => {

        const lineTotal =
          Number(item.price || 0) *
          Number(item.quantity || 0);

        return `
          <article class="checkout-item">

            <div class="checkout-item-top">

              <div class="checkout-item-name">
                ${escapeHtml(
                  item.name || "Tanpa nama"
                )}
              </div>

              <div class="checkout-item-price">
                ${formatRupiah(lineTotal)}
              </div>

            </div>

            <div class="checkout-item-bottom">

              <span>
                ${item.quantity} × ${formatRupiah(
                  item.price
                )}
              </span>

              <span>
                ${item.quantity} item
              </span>

            </div>

          </article>
        `;
      })
      .join("");
}

function updateCheckoutLocationUI() {

  const status =
    document.getElementById(
      "checkoutLocationStatus"
    );

  const coordinates =
    document.getElementById(
      "checkoutCoordinates"
    );

  if (!status || !coordinates) {
    return;
  }

  if (
    customerPosition &&
    Number.isFinite(
      customerPosition.latitude
    ) &&
    Number.isFinite(
      customerPosition.longitude
    )
  ) {

    status.textContent =
      "✓ Lokasi GPS tersedia dan akan dikirim bersama pesanan.";

    coordinates.textContent =
      `Koordinat: ${customerPosition.latitude.toFixed(
        6
      )}, ${customerPosition.longitude.toFixed(
        6
      )}`;

    return;
  }

  status.textContent =
    "⚠ Lokasi GPS belum tersedia.";

  coordinates.textContent =
    "Aktifkan lokasi sebelum membuat pesanan.";
}

function openCheckoutModal() {

  if (!currentUser) {

    alert(
      "Silakan login terlebih dahulu."
    );

    return;
  }

  if (!cart.items.length) {

    alert(
      "Keranjang masih kosong."
    );

    return;
  }

  const modal =
    document.getElementById(
      "checkoutModal"
    );

  if (!modal) {
    return;
  }

  const vendorName =
    document.getElementById(
      "checkoutVendorName"
    );

  const subtotal =
    document.getElementById(
      "checkoutSubtotal"
    );

  const total =
    document.getElementById(
      "checkoutTotal"
    );

  if (vendorName) {

    vendorName.textContent =
      cart.vendorName || "Mitra";
  }

  if (subtotal) {

    subtotal.textContent =
      formatRupiah(
        getCartTotal()
      );
  }

  if (total) {

    total.textContent =
      formatRupiah(
        getCartTotal()
      );
  }

  renderCheckoutItems();

  updateCheckoutLocationUI();

  modal.classList.remove(
    "hidden"
  );
}

function closeCheckoutModal() {

  const modal =
    document.getElementById(
      "checkoutModal"
    );

  if (!modal) {
    return;
  }

  modal.classList.add(
    "hidden"
  );
}

async function handleCartCheckout() {

  console.log(
    "[ORDER DEBUG] handleCartCheckout() TERPANGGIL"
  );

  console.log(
    "[ORDER DEBUG] currentUser:",
    currentUser
  );

  console.log(
    "[ORDER DEBUG] cart:",
    cart
  );

  console.log(
    "[ORDER DEBUG] customerPosition:",
    customerPosition
  );

  if (!currentUser) {

    alert(
      "Silakan login terlebih dahulu."
    );

    return;
  }

  if (!cart.items.length) {

    alert(
      "Keranjang masih kosong."
    );

    return;
  }

  if (!cart.vendorId) {

    alert(
      "Mitra pesanan tidak ditemukan."
    );

    return;
  }

  if (
    !customerPosition ||
    !Number.isFinite(
      customerPosition.latitude
    ) ||
    !Number.isFinite(
      customerPosition.longitude
    )
  ) {

    alert(
      "Lokasi GPS belum tersedia. Aktifkan izin lokasi lalu coba lagi."
    );

    return;
  }

  console.log(
    "[ORDER DEBUG] CHECKPOINT A: sebelum mengambil elemen checkout"
  );

  let addressInput;
  let notesInput;
  let placeOrderButton;

  try {
    addressInput =
      document.getElementById(
        "checkoutAddress"
      );

    console.log(
      "[ORDER DEBUG] CHECKPOINT B: checkoutAddress:",
      addressInput
    );

    notesInput =
      document.getElementById(
        "checkoutNotes"
      );

    console.log(
      "[ORDER DEBUG] CHECKPOINT C: checkoutNotes:",
      notesInput
    );

    placeOrderButton =
      document.getElementById(
        "placeOrderButton"
      );

    console.log(
      "[ORDER DEBUG] CHECKPOINT D: placeOrderButton:",
      placeOrderButton
    );

  } catch (error) {
    console.error(
      "[ORDER DEBUG] ERROR mengambil elemen checkout:",
      error
    );

    alert(
      "Terjadi error saat membaca form checkout. Cek console."
    );

    return;
  }

  console.log(
    "[ORDER DEBUG] CHECKPOINT E: sebelum membaca alamat"
  );

  let deliveryAddress = "";
  let notes = "";

  try {
    deliveryAddress =
      addressInput?.value.trim() || "";

    notes =
      notesInput?.value.trim() || "";

    console.log(
      "[ORDER DEBUG] CHECKPOINT F: alamat berhasil dibaca"
    );

  } catch (error) {
    console.error(
      "[ORDER DEBUG] ERROR membaca alamat/notes:",
      error
    );

    alert(
      "Terjadi error saat membaca alamat checkout. Cek console."
    );

    return;
  }

  console.log("[ORDER DEBUG] deliveryAddress:", deliveryAddress);
  console.log("[ORDER DEBUG] notes:", notes);
  console.log("[ORDER DEBUG] customerPosition valid:", {
    exists: !!customerPosition,
    latitude: customerPosition?.latitude,
    longitude: customerPosition?.longitude,
  });
  console.log("[ORDER DEBUG] cart validation:", {
    vendorId: cart?.vendorId,
    vendorName: cart?.vendorName,
    itemCount: cart?.items?.length,
  });

  if (!deliveryAddress) {

    alert(
      "Mohon isi alamat atau patokan pengantaran."
    );

    addressInput?.focus();

    return;
  }

  if (placeOrderButton) {

    placeOrderButton.disabled =
      true;

    placeOrderButton.textContent =
      "Membuat pesanan...";
  }

  try {

    const orderRef =
      doc(
        collection(
          db,
          "orders"
        )
      );

    const items =
      cart.items.map(
        (item) => ({

          menuId:
            String(
              item.menuId
            ),

          name:
            String(
              item.name || ""
            ),

          price:
            Number(
              item.price || 0
            ),

          quantity:
            Number(
              item.quantity || 0
            ),

          lineTotal:
            Number(
              item.price || 0
            ) *
            Number(
              item.quantity || 0
            ),
        })
      );

    const subtotal =
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.lineTotal || 0
          ),
        0
      );

    console.log(
      "[ORDER DEBUG] SIAP MENULIS KE FIRESTORE"
    );

    console.log(
      "[ORDER DEBUG] orderRef:",
      orderRef.id
    );

    console.log(
      "[ORDER DEBUG] orderData:",
      {
        customerId: currentUser.uid,
        vendorId: cart.vendorId,
        vendorName: cart.vendorName,
        items,
        subtotal,
        total: subtotal,
        paymentMethod: "cod",
        status: "pending",
        customerLocation: {
          lat: Number(customerPosition.latitude),
          lng: Number(customerPosition.longitude),
        },
        deliveryAddress,
        notes,
      }
    );

    await setDoc(
      orderRef,
      {

        customerId:
          currentUser.uid,

        vendorId:
          cart.vendorId,

        vendorName:
          cart.vendorName || "",

        items,

        subtotal,

        total:
          subtotal,

        paymentMethod:
          "cod",

        status:
          "pending",

        customerLocation: {

          lat:
            Number(
              customerPosition.latitude
            ),

          lng:
            Number(
              customerPosition.longitude
            ),
        },

        deliveryAddress,

        notes,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      }
    );

    const orderId =
      orderRef.id;

    console.log(
      "[ORDER DEBUG] FIRESTORE WRITE BERHASIL:",
      orderId
    );

    clearCart();

    closeCheckoutModal();

    alert(
      `Pesanan berhasil dibuat.\n\nNomor pesanan: ${orderId}\nStatus: Menunggu konfirmasi mitra.`
    );

    console.log(
      "[ORDER] Pesanan berhasil dibuat:",
      orderId
    );

  } catch (error) {

    console.error(
      "[ORDER] Gagal membuat pesanan:",
      error
    );

    alert(
      "Pesanan gagal dibuat. Silakan coba lagi."
    );

  } finally {

    if (placeOrderButton) {

      placeOrderButton.disabled =
        false;

      placeOrderButton.textContent =
        "Buat Pesanan";
    }
  }
}


/* ==================================================
   VENDOR PROFILE MODAL
================================================== */

function openVendorProfile(
  vendor
) {
  if (!vendor) {
    return;
  }

  selectedVendor =
    vendor;

  modalVendorName.textContent =
    vendor.businessName ||
    "Mitra IderinAja";

  modalVendorUsername.textContent =
    vendor.username
      ? `@${vendor.username}`
      : "Username belum tersedia";

  modalVendorCategory.textContent =
    vendor.category ||
    "Lainnya";

  /*
   * Pastikan container menu tersedia
   * sebelum menu dimuat.
   */
  let menuSection =
    document.getElementById(
      "modalVendorMenu"
    );

  if (!menuSection) {
    menuSection =
      document.createElement(
        "div"
      );

    menuSection.id =
      "modalVendorMenu";

    menuSection.className =
      "vendor-menu-section";

    subscribeButton.parentElement.insertBefore(
      menuSection,
      subscribeButton
    );
  }

  /*
   * Update tombol subscribe.
   */
  updateSubscribeButton();

  /*
   * Tampilkan modal.
   */
  vendorModal.classList.remove(
    "hidden"
  );

  /*
   * Baru load menu setelah
   * container tersedia.
   */
  loadVendorMenus(
    vendor.id
  );
}

function formatRupiah(
  value
) {
  const amount =
    Number(value) || 0;

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }
  ).format(amount);
}

function closeVendorProfile() {
  vendorModal.classList.add(
    "hidden"
  );

  selectedVendor =
    null;
}

/* ==================================================
   REALTIME VENDOR LISTENER
================================================== */
/* ==================================================
   REALTIME CUSTOMER ORDER STATUS
================================================== */
const customerOrderStatusMeta = {
  pending: {
    label: "Menunggu konfirmasi",
    icon: "⏳",
    className: "pending",
  },

  accepted: {
    label: "Pesanan diterima",
    icon: "✅",
    className: "accepted",
  },

  rejected: {
    label: "Pesanan ditolak",
    icon: "❌",
    className: "rejected",
  },

  completed: {
    label: "Pesanan selesai",
    icon: "🏁",
    className: "completed",
  },
};

function formatOrderDate(timestamp) {
  if (!timestamp?.toDate) {
    return "Waktu belum tersedia";
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(timestamp.toDate());
}

function renderCustomerOrders(orders) {
  window.__customerOrders = orders;

  const list =
    document.getElementById(
      "customerOrdersList"
    );

  const count =
    document.getElementById(
      "customerOrderCount"
    );

  if (!list) {
    return;
  }

  if (count) {
    count.textContent =
      `${orders.length} pesanan`;
  }

  if (orders.length === 0) {
    list.innerHTML = `
      <div class="customer-orders-empty">
        Belum ada pesanan.
      </div>
    `;

    return;
  }

  list.innerHTML = orders
    .map((order) => {

      const meta =
        customerOrderStatusMeta[
          order.status
        ] || {
          label: "Status tidak diketahui",
          icon: "ℹ️",
          className: "unknown",
        };

      const itemSummary =
        Array.isArray(order.items) &&
        order.items.length
          ? order.items
              .map(
                (item) =>
                  `${escapeHtml(
                    item.name || "Menu"
                  )} × ${Number(
                    item.quantity || 0
                  )}`
              )
              .join(" • ")
          : "Item pesanan tidak tersedia";

      return `
          <article
  class="customer-order-item"
  data-order-id="${escapeHtml(order.id)}"
>
          <div
            class="customer-order-top"
          >

            <div>

              <div
                class="customer-order-vendor"
              >
                ${escapeHtml(
                  order.vendorName ||
                  "Mitra IderinAja"
                )}
              </div>

              <div
                class="customer-order-id"
              >
                ID:
                ${escapeHtml(
                  order.id
                )}
              </div>

            </div>

            <span
              class="customer-order-status ${meta.className}"
            >
              ${meta.icon}
              ${meta.label}
            </span>

          </div>

          <div
            class="customer-order-items"
          >
            ${itemSummary}
          </div>

          <div
            class="customer-order-bottom"
          >

            <span>
              ${formatOrderDate(
                order.createdAt
              )}
            </span>

            <strong>
              ${formatRupiah(
                order.total
              )}
            </strong>

          </div>

        </article>
      `;
    })
    .join("");
}
function showCustomerOrderDetail(orderId) {
  const order = window.__customerOrders?.find(
    (item) => item.id === orderId
  );

  if (!order) {
    console.warn(
      "[CUSTOMER ORDERS] Pesanan tidak ditemukan:",
      orderId
    );

    return;
  }

  const meta =
    customerOrderStatusMeta[order.status] || {
      label: "Status tidak diketahui",
      icon: "ℹ️",
      className: "unknown",
    };

  const items = Array.isArray(order.items)
    ? order.items
    : [];

  const itemHtml = items.length
    ? items
        .map(
          (item) => `
            <div class="order-detail-item">
              <div>
                <strong>
                  ${escapeHtml(
                    item.name || "Menu"
                  )}
                </strong>

                <span>
                  × ${Number(
                    item.quantity || 0
                  )}
                </span>
              </div>

              <strong>
                ${formatRupiah(
                  Number(item.subtotal || 0)
                )}
              </strong>
            </div>
          `
        )
        .join("")
    : `
        <div class="customer-orders-empty">
          Item pesanan tidak tersedia.
        </div>
      `;

  const timeline = [
    {
      key: "pending",
      icon: "📝",
      label: "Pesanan dibuat",
    },
    {
      key: "accepted",
      icon: "✅",
      label: "Pesanan diterima mitra",
    },
    {
      key: "completed",
      icon: "🏁",
      label: "Pesanan selesai",
    },
  ];

  const currentStatusIndex =
    order.status === "rejected"
      ? -1
      : timeline.findIndex(
          (item) =>
            item.key === order.status
        );

  const timelineHtml = timeline
    .map((item, index) => {

      let className = "";

      if (
        order.status !== "rejected" &&
        currentStatusIndex >= index
      ) {
        className = "done";
      }

      if (
        order.status === "pending" &&
        item.key === "pending"
      ) {
        className = "active";
      }

      return `
        <div
          class="order-timeline-item ${className}"
        >
          <div class="order-timeline-icon">
            ${item.icon}
          </div>

          <div class="order-timeline-content">
            ${item.label}
          </div>
        </div>
      `;
    })
    .join("");

  const rejectedHtml =
    order.status === "rejected"
      ? `
        <div class="order-rejected-box">
          ❌ Pesanan ditolak oleh mitra.
        </div>
      `
      : "";

  const modal =
    document.getElementById(
      "customerOrderDetailModal"
    );

  if (!modal) {
    console.warn(
      "[CUSTOMER ORDERS] Modal detail belum tersedia."
    );

    return;
  }

  const vendor =
    document.getElementById(
      "customerOrderDetailVendor"
    );

  const status =
    document.getElementById(
      "customerOrderDetailStatus"
    );

  const id =
    document.getElementById(
      "customerOrderDetailId"
    );

  const itemsContainer =
    document.getElementById(
      "customerOrderDetailItems"
    );

  const timelineContainer =
    document.getElementById(
      "customerOrderTimeline"
    );

  const total =
    document.getElementById(
      "customerOrderDetailTotal"
    );

  if (vendor) {
    vendor.textContent =
      order.vendorName ||
      "Mitra IderinAja";
  }

  if (status) {
    status.className =
      `customer-order-status ${meta.className}`;

    status.textContent =
      `${meta.icon} ${meta.label}`;
  }

  if (id) {
    id.textContent =
      `ID: ${order.id}`;
  }

  if (itemsContainer) {
    itemsContainer.innerHTML =
      itemHtml;
  }

  if (timelineContainer) {
    timelineContainer.innerHTML =
      timelineHtml +
      rejectedHtml;
  }

  if (total) {
    total.textContent =
      formatRupiah(
        Number(order.total || 0)
      );
  }

  modal.classList.remove("hidden");
}
const closeCustomerOrderDetail =
  document.getElementById(
    "closeCustomerOrderDetail"
  );

if (closeCustomerOrderDetail) {
  closeCustomerOrderDetail.addEventListener(
    "click",
    () => {
      const modal =
        document.getElementById(
          "customerOrderDetailModal"
        );

      if (modal) {
        modal.classList.add("hidden");
      }
    }
  );
}

document.addEventListener(
  "click",
  (event) => {
    const orderCard =
      event.target.closest(
        ".customer-order-item"
      );

    if (!orderCard) {
      return;
    }

    const orderId =
      orderCard.dataset.orderId;

    if (!orderId) {
      return;
    }

    showCustomerOrderDetail(
      orderId
    );
  }
);

function startCustomerOrdersListener() {
  if (!currentUser) {
    return;
  }

  if (stopCustomerOrdersListener) {
    stopCustomerOrdersListener();
    stopCustomerOrdersListener = null;
  }

  const ordersQuery = query(
    collection(db, "orders"),
    where(
      "customerId",
      "==",
      currentUser.uid
    )
  );

  console.log(
    "[CUSTOMER ORDERS] Listener dimulai:",
    currentUser.uid
  );

  stopCustomerOrdersListener =
    onSnapshot(
      ordersQuery,

      (snapshot) => {
        const orders =
          snapshot.docs
            .map((orderSnapshot) => ({
              id:
                orderSnapshot.id,

              ...orderSnapshot.data(),
            }))
            .sort((a, b) => {
              const timeA =
                a.createdAt?.toMillis?.() ||
                0;

              const timeB =
                b.createdAt?.toMillis?.() ||
                0;

              return (
                timeB - timeA
              );
            });
        renderCustomerOrders(
  orders
);

        console.log(
          "[CUSTOMER ORDERS] Realtime update:",
          orders.map(
            (order) => ({
              id: order.id,
              status:
                order.status,
              vendorId:
                order.vendorId,
              vendorName:
                order.vendorName,
            })
          )
        );

        orders.forEach(
          (order) => {
            console.log(
              `[CUSTOMER ORDERS] ${order.id} → ${order.status}`
            );
          }
        );
      },

      (error) => {
        console.error(
          "[CUSTOMER ORDERS] Listener error:",
          error
        );
      }
    );
}

async function initializeNearbyNotifications() {
  const button = document.getElementById("enableNearbyNotifications");

  if (!("Notification" in window)) {
    if (button) button.classList.add("hidden");
    return;
  }

  if (Notification.permission === "granted") {
    if (button) {
      button.textContent = "🔔 Notifikasi aktif";
      button.classList.add("enabled");
    }

    if ("serviceWorker" in navigator) {
      try {
        notificationServiceWorkerRegistration =
          await navigator.serviceWorker.register(
            "nearby-notifications-sw.js",
            { scope: "./" }
          );
      } catch (error) {
        console.warn("[NOTIFY] Service worker gagal didaftarkan:", error);
      }
    }

    return;
  }

  if (Notification.permission === "denied") {
    if (button) {
      button.textContent = "🔕 Notifikasi diblokir";
      button.disabled = true;
    }
    return;
  }

  if (button) button.classList.remove("hidden");
}

async function enableNearbyNotifications() {
  const button = document.getElementById("enableNearbyNotifications");

  if (!("Notification" in window)) {
    alert("Browser ini belum mendukung notifikasi.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      if (button) {
        button.textContent =
          permission === "denied"
            ? "🔕 Notifikasi diblokir"
            : "🔔 Aktifkan notifikasi";
      }
      return;
    }

    await initializeNearbyNotifications();

    // Jika Konsumen sudah berada dalam radius 50m saat
    // notifikasi baru diaktifkan, cek langsung tanpa
    // menunggu GPS Mitra berubah.
    checkAllNearbyVendorNotifications();

    if (notificationServiceWorkerRegistration) {
      await notificationServiceWorkerRegistration.showNotification(
        "IderinAja",
        {
          body: "Notifikasi pedagang sekitar sudah aktif.",
          tag: "iderinaja-notification-test",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
        }
      );
    }
  } catch (error) {
    console.error("[NOTIFY] Aktivasi notifikasi gagal:", error);
  }
}

async function notifyNearbyVendor(vendor, distanceMeters) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const vendorId = vendor.id;
  const businessName = vendor.businessName || "Mitra IderinAja";

  try {
    if (!notificationServiceWorkerRegistration && "serviceWorker" in navigator) {
      notificationServiceWorkerRegistration =
        await navigator.serviceWorker.getRegistration("./");
    }

    const options = {
      body:
        businessName +
        " sedang berada sekitar " +
        Math.round(distanceMeters) +
        " meter dari Anda.",
      tag: "iderinaja-nearby-" + vendorId,
      renotify: false,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: {
        vendorId,
        distanceMeters: Math.round(distanceMeters),
      },
    };

    if (notificationServiceWorkerRegistration) {
      await notificationServiceWorkerRegistration.showNotification(
        "Mitra IderinAja di sekitar Anda",
        options
      );
      return;
    }

    try {
      new Notification("Mitra IderinAja di sekitar Anda", options);
    } catch (error) {
      console.warn("[NOTIFY] Fallback Notification gagal:", error);
    }
  } catch (error) {
    console.warn("[NOTIFY] Gagal menampilkan notifikasi:", error);
  }
}

function checkNearbyVendorNotification(vendor) {
  if (
    !customerPosition ||
    vendor.isOnline !== true ||
    typeof vendor.latitude !== "number" ||
    typeof vendor.longitude !== "number"
  ) {
    return;
  }

  const distanceMeters = calculateDistance(
    customerPosition.latitude,
    customerPosition.longitude,
    vendor.latitude,
    vendor.longitude
  );

  const isNearby = distanceMeters <= 50;
  const wasNearby = vendorProximityState.get(vendor.id) === true;

  if (isNearby && !wasNearby) {
    vendorProximityState.set(vendor.id, true);
    notifyNearbyVendor(vendor, distanceMeters);
    return;
  }

  if (!isNearby && distanceMeters > 80 && wasNearby) {
    vendorProximityState.set(vendor.id, false);
  }
}

function checkAllNearbyVendorNotifications() {
  if (
    !customerPosition ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  allVendors
    .filter((vendor) => subscribedVendorIds.has(vendor.id))
    .forEach((vendor) => {
      checkNearbyVendorNotification(vendor);
    });
}

function stopAllVendorLocationListeners() {
  vendorLocationListeners.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn("[GPS] Gagal menghentikan listener lokasi Mitra:", error);
    }
  });

  vendorLocationListeners.clear();
}

function syncVendorLocationListeners() {
  if (!currentUser) {
    return;
  }

  const subscribedIds = new Set(
    allVendors
      .filter((vendor) => subscribedVendorIds.has(vendor.id))
      .map((vendor) => vendor.id)
  );

  vendorLocationListeners.forEach((unsubscribe, vendorId) => {
    if (!subscribedIds.has(vendorId)) {
      unsubscribe();
      vendorLocationListeners.delete(vendorId);

      const vendorIndex = allVendors.findIndex(
        (vendor) => vendor.id === vendorId
      );

      if (vendorIndex !== -1) {
        allVendors[vendorIndex] = {
          ...allVendors[vendorIndex],
          latitude: null,
          longitude: null,
          accuracy: null,
          isOnline: false,
        };
      }

      vendorProximityState.delete(vendorId);
    }
  });

  subscribedIds.forEach((vendorId) => {
    if (vendorLocationListeners.has(vendorId)) {
      return;
    }

    const locationRef = doc(
      db,
      "vendorLocations",
      vendorId
    );

    const unsubscribe = onSnapshot(
      locationRef,
      (snapshot) => {
        const vendorIndex = allVendors.findIndex(
          (vendor) => vendor.id === vendorId
        );

        if (vendorIndex === -1) {
          return;
        }

        const baseVendor = allVendors[vendorIndex];

        if (!snapshot.exists()) {
          allVendors[vendorIndex] = {
            ...baseVendor,
            latitude: null,
            longitude: null,
            accuracy: null,
            isOnline: false,
          };
          vendorProximityState.delete(vendorId);
        } else {
          const location = snapshot.data();

          allVendors[vendorIndex] = {
            ...baseVendor,
            latitude:
              typeof location.latitude === "number"
                ? location.latitude
                : null,
            longitude:
              typeof location.longitude === "number"
                ? location.longitude
                : null,
            accuracy:
              typeof location.accuracy === "number"
                ? location.accuracy
                : null,
            isOnline:
              location.isOnline === true,
          };
        }

        renderVendorResults();
        updateVendorMarkers(allVendors);
        checkNearbyVendorNotification(allVendors[vendorIndex]);

        const onlineCount = allVendors.filter(
          (vendor) =>
            vendor.isOnline === true &&
            typeof vendor.latitude === "number" &&
            typeof vendor.longitude === "number"
        ).length;

        connectionStatus.textContent =
          `Realtime aktif • ${onlineCount} mitra online • GPS realtime berdasarkan langganan`;

        connectionStatus.classList.add("online");
      },
      (error) => {
        console.warn(
          "[GPS] Listener lokasi Mitra gagal:",
          vendorId,
          error
        );

        const vendorIndex = allVendors.findIndex(
          (vendor) => vendor.id === vendorId
        );

        if (vendorIndex !== -1) {
          allVendors[vendorIndex] = {
            ...allVendors[vendorIndex],
            latitude: null,
            longitude: null,
            accuracy: null,
            isOnline: false,
          };

          renderVendorResults();
          updateVendorMarkers(allVendors);
        }
      }
    );

    vendorLocationListeners.set(vendorId, unsubscribe);
  });
}

function bindNearbyNotificationButton() {
  const button = document.getElementById("enableNearbyNotifications");

  if (!button || button.dataset.bound === "true") return;

  button.dataset.bound = "true";
  button.addEventListener("click", enableNearbyNotifications);
}

function startVendorListener() {
  if (stopVendorListener) {
    stopVendorListener();
  }

  const vendorsRef = collection(
    db,
    "vendorProfiles"
  );

  stopVendorListener = onSnapshot(
    vendorsRef,
    async (snapshot) => {
      const vendors = [];

      snapshot.forEach((documentSnapshot) => {
        const vendor = documentSnapshot.data();

        if (vendor.role === "vendor") {
          vendors.push({
            id: documentSnapshot.id,
            ...vendor,
          });
        }
      });

      stopAllVendorLocationListeners();

      allVendors = vendors;

      await loadSubscriptions();

      renderVendorResults();
      updateVendorMarkers(allVendors);

      syncVendorLocationListeners();

      const onlineCount = allVendors.filter(
        (vendor) =>
          vendor.isOnline === true &&
          typeof vendor.latitude === "number" &&
          typeof vendor.longitude === "number"
      ).length;

      connectionStatus.textContent =
        `Realtime aktif • ${onlineCount} mitra online • GPS realtime berdasarkan langganan`;

      connectionStatus.classList.add("online");

      console.log(
        "[VENDOR] Profil realtime + GPS subscription:",
        allVendors
      );
    },
    (error) => {
      console.error(
        "Vendor listener error:",
        error
      );

      connectionStatus.textContent =
        "Gagal membaca data mitra";

      connectionStatus.classList.remove(
        "online"
      );

      vendorList.innerHTML = `
        <div class="empty error">
          Gagal mengambil data mitra.
        </div>
      `;
    }
  );
}

/* ==================================================
   SEARCH EVENTS
================================================== */

vendorSearch.addEventListener(
  "input",
  () => {
    renderVendorResults();
  }
);

/* Category filter */

categoryFilter
  .querySelectorAll(
    "[data-category]"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          selectedCategory =
            button.dataset.category;

          categoryFilter
            .querySelectorAll(
              "[data-category]"
            )
            .forEach(
              (item) => {
                item.classList.remove(
                  "active"
                );
              }
            );

          button.classList.add(
            "active"
          );

          renderVendorResults();
        }
      );
    }
  );

/* ==================================================
   VENDOR ACTION EVENTS
================================================== */

vendorList.addEventListener(
  "click",
  async (event) => {
    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) {
      return;
    }

    const vendorId =
      button.dataset.vendorId;

    const vendor =
      allVendors.find(
        (item) =>
          item.id ===
          vendorId
      );

    if (!vendor) {
      return;
    }

    const action =
      button.dataset.action;

    if (
      action ===
      "profile"
    ) {
      openVendorProfile(
        vendor
      );

      return;
    }

    if (
      action ===
      "subscribe"
    ) {
      selectedVendor =
        vendor;

      await subscribeToVendor(
        vendor
      );

      return;
    }

    if (
      action ===
      "unsubscribe"
    ) {
      await unsubscribeFromVendor(
        vendor
      );
    }
  }
);

/* ==================================================
   MODAL EVENTS
================================================== */

closeVendorModal.addEventListener(
  "click",
  closeVendorProfile
);

vendorModal.addEventListener(
  "click",
  (event) => {
    if (
      event.target ===
      vendorModal
    ) {
      closeVendorProfile();
    }
  }
);

subscribeButton.addEventListener(
  "click",
  async () => {
    if (!selectedVendor) {
      return;
    }

    if (
      subscribedVendorIds.has(
        selectedVendor.id
      )
    ) {
      await unsubscribeFromVendor(
        selectedVendor
      );

      return;
    }

    await subscribeToVendor(
      selectedVendor
    );
  }
);

/* ==================================================
   AUTH + ROLE GUARD
================================================== */
/* ==================================================
   AUTH + CUSTOMER PROFILE VERIFICATION
================================================== */

onAuthStateChanged(
  auth,
  async (user) => {
    console.log(
      "[AUTH 1] onAuthStateChanged dipanggil."
    );

    try {
      /* ------------------------------------------
         STEP 1 — CEK SESI FIREBASE AUTH
      ------------------------------------------ */

      console.log(
        "[AUTH 2] User:",
        user
      );

      if (!user) {
        console.log(
          "[AUTH 3] Tidak ada sesi Firebase."
        );

        window.location.replace(
          "login-customer.html"
        );

        return;
      }

      console.log(
        "[AUTH 3] Sesi ditemukan."
      );

      console.log(
        "[AUTH 4] UID:",
        user.uid
      );

      console.log(
        "[AUTH 5] Phone:",
        user.phoneNumber
      );

      /* ------------------------------------------
         STEP 2 — BUAT REFERENSI PROFIL
      ------------------------------------------ */

      console.log(
        "[FIRESTORE 1] Membuat reference users/" +
          user.uid
      );

      const userRef = doc(
        db,
        "users",
        user.uid
      );

      console.log(
        "[FIRESTORE 2] Reference berhasil dibuat."
      );

      /* ------------------------------------------
         STEP 3 — BACA PROFIL FIRESTORE
      ------------------------------------------ */

      console.log(
        "[FIRESTORE 3] Memulai getDoc()..."
      );

      const userSnapshot =
        await Promise.race([
          getDoc(userRef),

          new Promise((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  "TIMEOUT_GET_USER_PROFILE"
                )
              );
            }, 10000);
          }),
        ]);

      console.log(
        "[FIRESTORE 4] getDoc() selesai."
      );

      /* ------------------------------------------
         STEP 4 — CEK DOKUMEN
      ------------------------------------------ */

      console.log(
        "[PROFILE 1] Memeriksa keberadaan dokumen..."
      );

      if (!userSnapshot.exists()) {
        console.error(
          "[PROFILE 2] Dokumen users/" +
            user.uid +
            " TIDAK ditemukan."
        );

        showError(
          "Profil Konsumen tidak ditemukan."
        );

        return;
      }

      console.log(
        "[PROFILE 2] Dokumen profil ditemukan."
      );

      /* ------------------------------------------
         STEP 5 — BACA DATA PROFIL
      ------------------------------------------ */

      const profile =
        userSnapshot.data();

      console.log(
        "[PROFILE 3] Data profil:",
        profile
      );

      console.log(
        "[PROFILE 4] Role:",
        profile.role
      );

      /* ------------------------------------------
         STEP 6 — VALIDASI ROLE
      ------------------------------------------ */

      if (
        profile.role !==
        "customer"
      ) {
        console.error(
          "[PROFILE 5] Role tidak valid:",
          profile.role
        );

        showError(
          "Akun ini bukan akun Konsumen."
        );

        return;
      }

      console.log(
        "[PROFILE 5] Role customer valid."
      );

      /* ------------------------------------------
         STEP 7 — SIMPAN USER AKTIF
      ------------------------------------------ */

      currentUser =
        user;
      bindNearbyNotificationButton();
      initializeNearbyNotifications();

      console.log(
        "[DASHBOARD 1] currentUser berhasil disimpan."
      );

      /* ------------------------------------------
         STEP 8 — TAMPILKAN DASHBOARD
      ------------------------------------------ */

      console.log(
        "[DASHBOARD 2] Menyembunyikan loading."
      );

      loading.classList.add(
        "hidden"
      );

      console.log(
        "[DASHBOARD 3] Menyembunyikan error screen."
      );

      errorScreen.classList.add(
        "hidden"
      );

      console.log(
        "[DASHBOARD 4] Menampilkan dashboard."
      );

      dashboard.classList.remove(
        "hidden"
      );

      /* ------------------------------------------
         STEP 9 — INITIALIZE MAP
      ------------------------------------------ */

      console.log(
        "[MAP 1] Memulai initializeMap()."
      );

      initializeMap();

      console.log(
        "[MAP 2] initializeMap() selesai."
      );

      /* ------------------------------------------
         STEP 10 — GPS CUSTOMER
      ------------------------------------------ */

      console.log(
        "[GPS 1] Memulai lokasi customer."
      );

      startCustomerLocation();

      console.log(
        "[GPS 2] startCustomerLocation() selesai."
      );

      /* ------------------------------------------
         STEP 11 — LOAD VENDORS
      ------------------------------------------ */

      console.log(
        "[VENDOR 1] Memulai listener vendor."
      );

      startVendorListener();

      console.log(
        "[VENDOR 2] startVendorListener() selesai."
      );

      /* ------------------------------------------
         SELESAI
      ------------------------------------------ */

      console.log(
        "======================================"
      );

      console.log(
        "[SUCCESS] CUSTOMER DASHBOARD SIAP."
      );

      console.log(
        "======================================"
      );

    } catch (error) {

      /* ------------------------------------------
         ERROR GLOBAL
      ------------------------------------------ */

      console.error(
        "======================================"
      );

      console.error(
        "[FATAL AUTH/DASHBOARD ERROR]"
      );

      console.error(
        error
      );

      console.error(
        "======================================"
      );

      let message =
        error?.message ||
        "Kesalahan tidak diketahui.";

      if (
        message ===
        "TIMEOUT_GET_USER_PROFILE"
      ) {
        message =
          "Firestore tidak merespons saat membaca profil Konsumen.";
      }

      showError(
        "Verifikasi akun gagal: " +
          message
      );
    }
  }
);


/* =========================================
   CART EVENTS
========================================= */

document.addEventListener(
  "click",
  (event) => {

    const addButton =
      event.target.closest(
        ".add-cart-button"
      );

    if (addButton) {

      if (!selectedVendor) {

        alert(
          "Mitra belum dipilih."
        );

        return;
      }

      const menuId =
        addButton.dataset.menuId;

      const menuElement =
        addButton.closest(
          ".vendor-menu-item"
        );
if (!menuElement) return;

      const menu = {
        id: menuId,

        name:
          menuElement
            .querySelector(
              ".vendor-menu-name"
            )
            ?.textContent
            ?.trim() ||
          "Menu",

        price:
          Number(
            menuElement
              .querySelector(
                ".vendor-menu-price"
              )
              ?.textContent
              ?.replace(
                /[^\d]/g,
                ""
              ) ||
            0
          ),

        stock:
          Number(
            menuElement
              .querySelector(
                ".vendor-menu-stock"
              )
              ?.textContent
              ?.replace(
                /[^\d]/g,
                ""
              ) ||
            0
          ),

        isAvailable: true,
      };

      addToCart(
        selectedVendor,
        menu
      );

      return;
    }

    const menuMinus =
      event.target.closest(
        ".menu-minus"
      );

    if (menuMinus) {

      changeCartQuantity(
        menuMinus.dataset.menuId,
        -1
      );

      return;
    }

    const menuPlus =
      event.target.closest(
        ".menu-plus"
      );

    if (menuPlus) {

      changeCartQuantity(
        menuPlus.dataset.menuId,
        1
      );

      return;
    }

    const cartMinus =
      event.target.closest(
        ".cart-minus"
      );

    if (cartMinus) {

      changeCartQuantity(
        cartMinus.dataset.menuId,
        -1
      );

      return;
    }

    const cartPlus =
      event.target.closest(
        ".cart-plus"
      );

    if (cartPlus) {

      changeCartQuantity(
        cartPlus.dataset.menuId,
        1
      );

      return;
    }

    const cartRemove =
      event.target.closest(
        ".cart-remove"
      );

    if (cartRemove) {

      removeCartItem(
        cartRemove.dataset.menuId
      );

      return;
    }

    if (
      event.target.closest(
        "#openCartButton"
      )
    ) {

      openCartModal();

      return;
    }

    if (
      event.target.closest(
        "#closeCartButton"
      )
    ) {

      closeCartModal();

      return;
    }
if (
      event.target.closest(
        "#cartCheckoutButton"
      )
    ) {

      openCheckoutModal();

      return;
    }

    if (
      event.target.closest(
        "#closeCheckoutButton"
      )
    ) {

      closeCheckoutModal();

      return;
    }

    if (
      event.target.closest(
        "#placeOrderButton"
      )
    ) {

      console.log(
        "[ORDER DEBUG] TOMBOL BUAT PESANAN DIKLIK"
      );

      handleCartCheckout();

      return;
    }

    if (
      event.target.id ===
      "cartModal"
    ) {

      closeCartModal();

      return;
    }

    if (
      event.target.id ===
      "checkoutModal"
    ) {

      closeCheckoutModal();
    }
  }
);

console.log(
  "[CART] Event delegation aktif"
);

console.log(
  "[ORDER DEBUG] Checkout event handler aktif"
);