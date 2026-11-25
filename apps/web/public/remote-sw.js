// The phone and browser app's service worker (decisions §64.10). A push
// carries no content: it only says Titan117 needs you, and opening it shows
// the Remote page, which reads the sealed messages itself.
self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('Titan117', {
      body: 'Titan117 needs you. Open to see what happened.',
      tag: 'titan117-remote',
      icon: '/app-icon-512.png'
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).pathname.startsWith('/remote'))
      return open ? open.focus() : self.clients.openWindow('/remote')
    })
  )
})
