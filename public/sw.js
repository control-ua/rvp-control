const CACHE_NAME = 'rvp-control-v4-push';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
    ]),
  );
});

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'RVP Control',
      body: event.data ? event.data.text() : 'Нове сповіщення',
    };
  }

  const title = data.title || 'RVP Control';
  const options = {
    body: data.body || 'Нова подія',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || data.application_id || 'rvp-notification',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || './',
      application_id: data.application_id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || './',
    self.registration.scope,
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'RVP_PUSH_OPEN',
            application_id: event.notification.data?.application_id || null,
          });
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
