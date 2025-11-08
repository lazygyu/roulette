import { generateSW } from 'workbox-build';

generateSW({
  swDest: 'dist/service-worker.js',
  globDirectory: 'dist',
  globPatterns: [
    '**/*.{html,js,css,png,svg}',
  ],
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: /\/.(?:png|jpg|svg)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\.(?:js|css|html)$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
      },
    },
  ],
});
