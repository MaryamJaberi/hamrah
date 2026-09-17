self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'همراه', { body: d.body || '', data: { url: d.url || '/' }, dir: 'rtl', lang: 'fa' }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then((wins) => {
    const url = e.notification.data.url;
    for (const w of wins) if ('focus' in w) { w.navigate(url); return w.focus(); }
    return clients.openWindow(url);
  }));
});
