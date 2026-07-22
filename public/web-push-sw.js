self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Kloak";
  const options = {
    body: payload.body || undefined,
    icon: "/favicon-32x32.png",
    badge: "/favicon-32x32.png",
    tag: payload.notificationId || payload.link || "kloak-notification",
    data: {
      link: payload.link || "/app",
      notificationId: payload.notificationId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link = event.notification.data && event.notification.data.link ? event.notification.data.link : "/app";
  const targetUrl = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    }),
  );
});
