self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const vendorId =
    event.notification.data?.vendorId || "";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({
            type: "IDERINAJA_VENDOR_NOTIFICATION_CLICK",
            vendorId,
          });
          return client.focus();
        }
      }

      if (clients.openWindow) {
        const target =
          vendorId
            ? `./customer-dashboard.html?vendor=${encodeURIComponent(vendorId)}`
            : "./customer-dashboard.html";
        return clients.openWindow(target);
      }

      return undefined;
    })
  );
});
