import {
  firebaseApp,
  firestoreDb,
} from "./firebase/config.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const auth = getAuth(firebaseApp);

const db = firestoreDb;

const vendorList =
  document.getElementById("vendorList");

const vendorCount =
  document.getElementById("vendorCount");

const connectionStatus =
  document.getElementById("connectionStatus");

let unsubscribeVendors = null;

function renderVendors(vendors) {
  vendorCount.textContent =
    `${vendors.length} mitra`;

  if (vendors.length === 0) {
    vendorList.innerHTML = `
      <div class="empty">
        Belum ada mitra yang sedang aktif.
      </div>
    `;

    return;
  }

  vendorList.innerHTML = "";

  vendors.forEach((vendor) => {
    const element =
      document.createElement("div");

    element.className = "vendor";

    element.innerHTML = `
      <div class="vendor-top">

        <div class="vendor-name">
          Mitra IderinAja
        </div>

        <div class="online">
          ● ONLINE
        </div>

      </div>

      <div class="vendor-data">

        <div>
          Latitude:
          ${Number(vendor.latitude).toFixed(6)}
        </div>

        <div>
          Longitude:
          ${Number(vendor.longitude).toFixed(6)}
        </div>

        <div>
          Akurasi:
          ${Math.round(vendor.accuracy || 0)}
          meter
        </div>

      </div>
    `;

    vendorList.appendChild(element);
  });
}

function startVendorListener() {
  if (unsubscribeVendors) {
    unsubscribeVendors();
  }

  const vendorsRef =
    collection(db, "vendors");

  unsubscribeVendors =
    onSnapshot(
      vendorsRef,
      (snapshot) => {

        const vendors = [];

        snapshot.forEach((doc) => {

          const data = doc.data();

          if (
            data.role === "vendor" &&
            data.isOnline === true &&
            typeof data.latitude === "number" &&
            typeof data.longitude === "number"
          ) {
            vendors.push({
              id: doc.id,
              ...data,
            });
          }
        });

        renderVendors(vendors);

        connectionStatus.textContent =
          "Realtime aktif";

        connectionStatus.classList.add(
          "online"
        );

        console.log(
          "Vendors realtime:",
          vendors
        );
      },

      (error) => {

        console.error(
          "Vendor listener error:",
          error
        );

        connectionStatus.textContent =
          "Koneksi error";

        connectionStatus.classList.remove(
          "online"
        );

        vendorList.innerHTML = `
          <div class="empty">
            Gagal membaca lokasi mitra.
          </div>
        `;
      }
    );
}

onAuthStateChanged(
  auth,
  (user) => {

    if (!user) {

      vendorList.innerHTML = `
        <div class="empty">
          Silakan login terlebih dahulu.
        </div>
      `;

      connectionStatus.textContent =
        "Belum login";

      return;
    }

    console.log(
      "Customer authenticated:",
      user.uid
    );

    startVendorListener();
  }
);
