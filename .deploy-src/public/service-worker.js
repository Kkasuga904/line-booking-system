// Service Worker Kill Switch - 既存のSWを強制解除
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    (async () => {
      try {
        const regs = await self.registration.unregister();
        const clientsArr = await self.clients.matchAll();
        clientsArr.forEach(c => c.navigate(c.url));
      } catch (e) {}
    })()
  );
});