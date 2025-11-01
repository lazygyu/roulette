let CACHE_NAME="marble-roulette",urlsToCache=["/roulette","/roulette/index.html"];self.addEventListener("install",e=>{e.waitUntil(caches.open("marble-roulette").then(e=>e.addAll(urlsToCache)))}),self.addEventListener("fetch",e=>{e.respondWith(caches.match(e.request).then(t=>t||fetch(e.request)))});
//# sourceMappingURL=service-worker.js.map
