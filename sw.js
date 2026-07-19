const CACHE = "uretim-takip-cache-v310";
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
  /* KRİTİK: eskiden burada self.clients.claim() da çağrılıyordu — bu,
     hâlâ AÇIK olan sekmeleri yeni SW yayına girer girmez ANINDA ele
     geçiriyordu. Kullanıcı bir sayfayı açık tutarken arka planda yeni bir
     sw.js sürümü algılanınca (skipWaiting zaten hemen aktive ediyor),
     clients.claim() o an devam eden fetch isteklerini yetim bırakıp
     "tamamen bomboş ekran, 2-3 yenilemede düzeliyor" hatasına yol açıyordu
     (kullanıcı raporu). claim() kaldırıldı: açık sekmeler eski SW ile
     sorunsuz çalışmaya devam eder, yeni SW sadece bir SONRAKİ tam
     yenilemede/navigasyonda devreye girer — anlık kesinti olmaz. */
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    })
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
