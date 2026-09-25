import { initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

export const sendVendorOrderPush = onDocumentCreated(
  "orders/{orderId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const order = snapshot.data();

    if (
      !order ||
      order.status !== "pending" ||
      !order.vendorId
    ) {
      return;
    }

    const tokenSnapshot = await db
      .collection("vendorPushTokens")
      .doc(order.vendorId)
      .get();

    if (!tokenSnapshot.exists) {
      console.log(
        "[FCM] Vendor belum memiliki push token:",
        order.vendorId
      );
      return;
    }

    const tokenData = tokenSnapshot.data() || {};
    const token = tokenData.token;

    if (!token) {
      console.log(
        "[FCM] Token vendor kosong:",
        order.vendorId
      );
      return;
    }

    const itemCount = Array.isArray(order.items)
      ? order.items.length
      : 0;

    const total = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(order.total) || 0);

    try {
      await messaging.send({
        token,
        notification: {
          title: "Pesanan baru masuk",
          body:
            `Pesanan baru • ${itemCount} item • ${total}`,
        },
        data: {
          orderId: String(event.params.orderId),
          type: "new_order",
        },
        webpush: {
          fcmOptions: {
            link:
              "https://iderinaja-auth.web.app/vendor-dashboard.html#ordersSection",
          },
        },
      });

      console.log(
        "[FCM] Push berhasil dikirim:",
        event.params.orderId
      );
    } catch (error) {
      console.error(
        "[FCM] Gagal mengirim push:",
        error
      );

      const code = error?.code || "";

      if (
        code.includes(
          "registration-token-not-registered"
        ) ||
        code.includes(
          "invalid-registration-token"
        )
      ) {
        await tokenSnapshot.ref.delete();

        console.log(
          "[FCM] Token invalid dihapus:",
          order.vendorId
        );
      }
    }
  }
);
