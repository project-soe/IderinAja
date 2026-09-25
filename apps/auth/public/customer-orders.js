import { firebaseApp, firestoreDb } from "./firebase/config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { doc, getDoc, collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const auth = getAuth(firebaseApp);
const db = firestoreDb;

const page = document.getElementById("page");
const loading = document.getElementById("loading");
const errorScreen = document.getElementById("error");
const errorMessage = document.getElementById("errorMessage");
const ordersList = document.getElementById("ordersList");
const orderCount = document.getElementById("orderCount");
const sectionTitle = document.getElementById("sectionTitle");
const connectionStatus = document.getElementById("connectionStatus");
const detailModal = document.getElementById("detailModal");
const detailVendor = document.getElementById("detailVendor");
const detailId = document.getElementById("detailId");
const detailStatus = document.getElementById("detailStatus");
const detailTimeline = document.getElementById("detailTimeline");
const detailItems = document.getElementById("detailItems");
const detailTotal = document.getElementById("detailTotal");

let currentUser = null;
let allOrders = [];
let activeTab = "active";
let stopOrdersListener = null;

const statusMeta = {
  pending: { label:"Menunggu konfirmasi", icon:"⏳", className:"pending" },
  accepted: { label:"Pesanan diterima", icon:"✅", className:"accepted" },
  rejected: { label:"Pesanan ditolak", icon:"❌", className:"rejected" },
  completed: { label:"Pesanan selesai", icon:"🏁", className:"completed" },
};

const activeStatuses = new Set(["pending","accepted"]);

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function formatRupiah(value){
  return new Intl.NumberFormat("id-ID",{
    style:"currency",currency:"IDR",maximumFractionDigits:0
  }).format(Number(value)||0);
}

function formatOrderDate(timestamp){
  if (!timestamp?.toDate) return "Waktu belum tersedia";
  return new Intl.DateTimeFormat("id-ID",{
    dateStyle:"medium",timeStyle:"short"
  }).format(timestamp.toDate());
}

function showError(message){
  loading.classList.add("hidden");
  page.classList.add("hidden");
  errorScreen.classList.remove("hidden");
  errorMessage.textContent = message;
}

function getVisibleOrders(){
  return allOrders.filter(order =>
    activeTab === "active"
      ? activeStatuses.has(order.status)
      : !activeStatuses.has(order.status)
  );
}

function renderOrders(){
  const orders = getVisibleOrders();
  sectionTitle.textContent = activeTab === "active" ? "Sedang Berlangsung" : "Riwayat Pesanan";
  orderCount.textContent = `${orders.length} pesanan`;

  if (!orders.length){
    ordersList.innerHTML = activeTab === "active"
      ? `<div class="empty"><div class="empty-icon">🛵</div>Belum ada pesanan yang sedang berlangsung.</div>`
      : `<div class="empty"><div class="empty-icon">🧾</div>Belum ada riwayat pesanan.</div>`;
    return;
  }

  ordersList.innerHTML = orders.map(order => {
    const meta = statusMeta[order.status] || {
      label:"Status tidak diketahui",icon:"ℹ️",className:""
    };
    const items = Array.isArray(order.items) ? order.items : [];
    const summary = items.length
      ? items.slice(0,3).map(item => `${escapeHtml(item.name || "Menu")} × ${Number(item.quantity||0)}`).join(" • ")
        + (items.length > 3 ? ` • +${items.length-3} item` : "")
      : "Item pesanan tidak tersedia";

    return `
      <article class="order" data-order-id="${escapeHtml(order.id)}">
        <div class="order-top">
          <div class="vendor">
            <div class="vendor-name">${escapeHtml(order.vendorName || "Mitra IderinAja")}</div>
            <div class="order-id">ID: ${escapeHtml(order.id)}</div>
          </div>
          <span class="badge ${meta.className}">${meta.icon} ${meta.label}</span>
        </div>
        <div class="items">${summary}</div>
        <div class="bottom">
          <span>${formatOrderDate(order.createdAt)}</span>
          <strong>${formatRupiah(order.total)}</strong>
        </div>
      </article>
    `;
  }).join("");
}

function showOrderDetail(order){
  if (!order) return;

  const meta = statusMeta[order.status] || {
    label:"Status tidak diketahui",icon:"ℹ️",className:""
  };

  detailVendor.textContent = order.vendorName || "Mitra IderinAja";
  detailId.textContent = `ID: ${order.id}`;
  detailStatus.className = `detail-status badge ${meta.className}`;
  detailStatus.textContent = `${meta.icon} ${meta.label}`;

  const items = Array.isArray(order.items) ? order.items : [];
  detailItems.innerHTML = items.length
    ? items.map(item => `
        <div class="detail-item">
          <div><strong>${escapeHtml(item.name || "Menu")}</strong><br><span>${Number(item.quantity||0)} × ${formatRupiah(item.price)}</span></div>
          <strong>${formatRupiah(item.lineTotal ?? ((Number(item.price)||0)*(Number(item.quantity)||0)))}</strong>
        </div>
      `).join("")
    : `<div class="empty">Item pesanan tidak tersedia.</div>`;

  const timeline = [
    {key:"pending",icon:"📝",label:"Pesanan dibuat"},
    {key:"accepted",icon:"✅",label:"Pesanan diterima mitra"},
    {key:"completed",icon:"🏁",label:"Pesanan selesai"}
  ];
  const currentIndex = order.status === "rejected" ? -1 : timeline.findIndex(item => item.key === order.status);
  detailTimeline.innerHTML = timeline.map((item,index) => `
    <div class="timeline-item ${order.status !== "rejected" && currentIndex >= index ? "done" : ""}">
      <span class="timeline-icon">${item.icon}</span><span>${item.label}</span>
    </div>
  `).join("") + (order.status === "rejected"
    ? `<div class="rejected">❌ Pesanan ditolak oleh mitra.</div>`
    : "");

  detailTotal.textContent = formatRupiah(order.total);
  detailModal.classList.remove("hidden");
}

function startOrdersListener(){
  if (!currentUser) return;
  if (stopOrdersListener) stopOrdersListener();

  const ordersQuery = query(
    collection(db,"orders"),
    where("customerId","==",currentUser.uid)
  );

  stopOrdersListener = onSnapshot(ordersQuery, snapshot => {
    allOrders = snapshot.docs.map(item => ({
      id:item.id,
      ...item.data()
    })).sort((a,b) => (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0));

    renderOrders();
    connectionStatus.textContent = `Realtime aktif • ${allOrders.length} pesanan`;
    connectionStatus.classList.add("online");
  }, error => {
    console.error("[CUSTOMER ORDERS] Listener error:", error);
    connectionStatus.textContent = "Gagal membaca pesanan";
    connectionStatus.classList.remove("online");
  });
}

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    renderOrders();
  });
});

ordersList.addEventListener("click", event => {
  const card = event.target.closest(".order");
  if (!card) return;
  const order = allOrders.find(item => item.id === card.dataset.orderId);
  showOrderDetail(order);
});

document.getElementById("closeDetail")?.addEventListener("click", () => {
  detailModal.classList.add("hidden");
});
detailModal.addEventListener("click", event => {
  if (event.target === detailModal) detailModal.classList.add("hidden");
});

document.getElementById("backButton")?.addEventListener("click", () => {
  window.location.replace("customer-dashboard.html");
});
document.getElementById("homeButton")?.addEventListener("click", () => {
  window.location.replace("customer-dashboard.html");
});
document.getElementById("logoutButton")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.replace("login-customer.html");
  } catch(error) {
    console.error("[AUTH] Logout gagal:",error);
    alert("Logout gagal. Silakan coba lagi.");
  }
});

onAuthStateChanged(auth, async user => {
  try {
    if (!user) {
      window.location.replace("login-customer.html");
      return;
    }

    const profileSnapshot = await getDoc(doc(db,"users",user.uid));
    if (!profileSnapshot.exists() || profileSnapshot.data().role !== "customer") {
      showError("Akun ini bukan akun Konsumen.");
      return;
    }

    currentUser = user;
    loading.classList.add("hidden");
    errorScreen.classList.add("hidden");
    page.classList.remove("hidden");
    startOrdersListener();
  } catch(error) {
    console.error("[AUTH] Verifikasi pesanan gagal:",error);
    showError("Verifikasi akun gagal: " + (error?.message || "Kesalahan tidak diketahui."));
  }
});