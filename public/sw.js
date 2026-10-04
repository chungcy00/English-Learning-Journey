// One-time migration for installations created before background updates were removed.
// Wait for existing windows to close; never activate or navigate mid-task.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
  })());
});
