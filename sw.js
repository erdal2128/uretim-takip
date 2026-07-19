const CACHE = "uretim-takip-cache-v312";
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

/* KRİTİK (kullanıcı raporu — zayıf/kararsız bağlantıda tekrarlayan beyaz ekran):
   eskiden network-first'ti (önce ağı dene, N saniye içinde cevap gelmezse
   cache'e düş). Zayıf sinyalde istek ne başarıyla ne hatayla sonuçlanıyor,
   sadece "askıda" kalıyordu — kullanıcı "interneti kapatınca hemen açılıyor"
   diye bildirdi, çünkü interneti kapatmak isteği ANINDA başarısız kılıp
   catch/cache yoluna düşürüyordu; açıkken ise (zayıf ama canlı sinyal) fetch
   bir türlü sonuçlanmıyordu. Artık STALE-WHILE-REVALIDATE: cache'te bir kayıt
   varsa AĞI HİÇ BEKLEMEDEN anında o gösterilir (sinyal ne olursa olsun 0ms),
   ağdan taze sürüm arka planda sessizce indirilip cache'e yazılır — bir
   SONRAKİ açılışta görünür. Sadece cache TAMAMEN boşsa (ilk kurulum) ağ
   beklenir, o durumda da FETCH_TIMEOUT_MS güvenlik ağı hâlâ geçerli. */
var FETCH_TIMEOUT_MS = 4000;
self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method!=="GET") return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  function indexeDus(){
    return caches.match("./index.html").then(function(idx){
      return idx || caches.match("./");
    });
  }

  e.respondWith(
    caches.match(req).then(function(cached){
      /* Ağdan güncelleme her durumda arka planda tetiklenir (sonucu
         beklenmeden) — cache varsa bu güncelleme bir sonraki açılış içindir. */
      var agGuncelle = fetch(req).then(function(res){
        if(res && res.ok){
          var resClone = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, resClone); });
        }
        return res;
      }).catch(function(){ return null; });

      if(cached) return cached;

      /* Cache'te hiç kayıt yok (ilk kurulum/ilk ziyaret) — ağı beklemekten
         başka çare yok, ama sonsuza kadar askıda kalmasın diye zaman aşımı
         güvenlik ağı devrede. */
      var zamanAsimi = new Promise(function(resolve){
        setTimeout(function(){ resolve(indexeDus()); }, FETCH_TIMEOUT_MS);
      });
      return Promise.race([agGuncelle.then(function(res){ return res || indexeDus(); }), zamanAsimi]);
    })
  );
});
