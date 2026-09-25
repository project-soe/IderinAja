importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCo2mE2do07zqR4B8Q8w5mux9oO7cc2lj3I",
  authDomain: "absensitamu.firebaseapp.com",
  projectId: "absensitamu",
  storageBucket: "absensitamu.firebasestorage.app",
  messagingSenderId: "187515494925",
  appId: "1:187515494925:web:e72557897fd58f5a392b44",
  measurementId: "G-XBPX4ZMJ43",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};

  self.registration.showNotification(
    notification.title || "Pesanan baru masuk",
    {
      body:
        notification.body ||
        "Ada pesanan baru untuk Mitra.",
      tag: payload.data?.orderId
        ? "order-" + payload.data.orderId
        : "iderinaja-order",
      renotify: true,
      data: payload.data || {},
    }
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(
          "./vendor-dashboard.html#ordersSection"
        );
      }

      return undefined;
    })
  );
});
