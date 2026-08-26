// Service worker mínimo — só existe pra receber Web Push em segundo plano
// (mesmo com a aba fechada) e mostrar a notificação nativa do navegador.

self.addEventListener("push", (event) => {
  let dados = { title: "TLP Presença", body: "" };
  try {
    dados = event.data.json();
  } catch {
    // payload sem JSON válido — usa o texto puro como corpo
    dados.body = event.data?.text() ?? "";
  }
  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: "/logo-tlp.png",
      badge: "/logo-tlp.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
