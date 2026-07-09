const CACHE = "uretim-takip-cache-v201";
const CORE_ASSETS = ["./", "./index.html"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(CORE_ASSETS.map(function(url){
        return fetch(url).then(function(res){
          if(res && res.ok) return c.put(url, res);
        }).catch(function(){});
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method!=="GET") return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function(res){
      var resClone = res.clone();
      caches.open(CACHE).then(function(c){ c.put(req, resClone); });
      return res;
    }).catch(function(){
      return caches.match(req).then(function(m){
        if(m) return m;
        return caches.match("./index.html").then(function(idx){
          return idx || caches.match("./");
        });
      });
    })
  );
});
