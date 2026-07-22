# -*- coding: utf-8 -*-
"""
firestore_sync.py — Hasat Takip'ten Üretim Takip'e (web uygulaması) canlı senkron.

Üretim Takip zaten farms/{FARM_CODE}/hasat_tarti koleksiyonunu Firestore'da
CANLI dinliyor (onSnapshot) ve oda+tur eşleşmesiyle okuyor (bkz. index.html
içindeki hasatTartiGetir/hasatTakipKart fonksiyonları — Oda Detayı sayfasında
"Hasat Takip — günlük tartı" kartı olarak gösteriliyor). Bu modül SADECE o
koleksiyona yazar; Üretim Takip tarafında bu senkron için ek bir kurulum
gerekmez.

Eşleştirme: Üretim Takip odaları oda+tur (Günlük Tur'daki "Tur numarası")
ile eşleştiriyor. Mühendis tur numarasını yanlış girerse yanlış odaya
kayıt gitmiş olabilir — bunu yakalayabilmek için her kayda o oda+tur'un
kompost_detay'daki geliş tarihi de ("gelis_tarihi" alanı) eklenir; Üretim
Takip tarafı bunu kendi geliş tarihiyle karşılaştırıp uyuşmazsa uyarı
gösterir (veriyi yine de kabul eder, sadece ikaz eder).

Kimlik doğrulama: Web uygulamasının kullandığı AYNI anonim Firebase Auth
akışı, REST API üzerinden. Service account / admin anahtarı GEREKMEZ —
apiKey zaten web uygulamasının kaynak kodunda da açıkça görünür durumda
(Firebase'in güvenlik modeli budur: gerçek erişim kısıtlaması Firestore
kurallarındadır, apiKey gizli bir sır değildir).

Tasarım ilkeleri:
  - Ağ çağrıları HER ZAMAN arka plan thread'inde çalışır — Tkinter arayüzü
    senkron yüzünden asla donmaz/kilitlenmez.
  - Gönderilemeyen kayıtlar diskteki küçük bir kuyruk dosyasında
    (pending_sync.json) saklanır; internet dönünce otomatik tekrar denenir.
    Uygulama kapanıp açılsa bile kayıp olmaz.
  - Herhangi bir hata (internet yok, Firestore geçici hatası vb.) ana
    uygulamaya ASLA exception olarak yansımaz — sessizce kuyrukta kalır,
    bir sonraki denemede gönderilir. Hasat verisinin YEREL (SQLite)
    kaydına bu modül hiçbir zaman engel olmaz/dokunmaz.

Kullanım (hasat_takip_v70.py içinde):
    import firestore_sync

    def set_tarti_detay(self, oda, tarih, tur, flas, ana90, kestane, duble, dokme, ikinci):
        self.conn.execute(...)
        self.conn.commit()
        try:
            kd = self.get_kompost_detay(oda, tur)
            firestore_sync.enqueue_hasat_sync(
                oda, tarih, tur, flas, ana90, kestane, duble, dokme, ikinci,
                gelis_tarihi=kd.get("gelis", ""),
                firma=kd.get("firma", ""), tonaj=kd.get("tonaj", 0))
        except Exception:
            pass  # senkron asla yerel kaydı bozmasın
"""
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

# ==================== Ayarlar — Üretim Takip (index.html) ile AYNI ====================
FIREBASE_API_KEY = "AIzaSyDzG6DG2Z1xbGIBIy7gRM2yTENfrSq7Kh4"
FIREBASE_PROJECT_ID = "dirican-mantar"
FARM_CODE = "merkez"

_RETRY_SANIYE = 15          # kuyruk boşaltma denemesi arası bekleme
_HTTP_TIMEOUT = 10          # saniye


def _app_dir():
    """PyInstaller ile paketlenmişse .exe'nin, değilse .py'nin bulunduğu klasör."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


QUEUE_PATH = os.path.join(_app_dir(), "pending_sync.json")
AUTH_CACHE_PATH = os.path.join(_app_dir(), "sync_auth.json")

_lock = threading.Lock()
_queue = []            # bellekteki bekleyen kayıtlar (dict listesi)
_worker_started = False
_id_token = None
_refresh_token = None
_token_expiry = 0.0     # unix zaman damgası
_son_hata = None        # UI isterse okuyabilsin diye (bkz. son_durum())
_gonderilen_sayisi = 0


# ==================== Diskte kalıcı kuyruk ====================
def _load_queue():
    global _queue
    try:
        with open(QUEUE_PATH, "r", encoding="utf-8") as f:
            _queue = json.load(f)
            if not isinstance(_queue, list):
                _queue = []
    except Exception:
        _queue = []


def _save_queue():
    try:
        tmp = QUEUE_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(_queue, f, ensure_ascii=False)
        os.replace(tmp, QUEUE_PATH)
    except Exception:
        pass  # diske yazılamasa bile senkron bellekte devam eder, bir sonraki
              # başarılı kayıtta yeniden denenecektir


def _load_auth_cache():
    global _refresh_token
    try:
        with open(AUTH_CACHE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            _refresh_token = data.get("refresh_token")
    except Exception:
        _refresh_token = None


def _save_auth_cache():
    try:
        with open(AUTH_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump({"refresh_token": _refresh_token}, f)
    except Exception:
        pass


# ==================== Firebase Anonim Kimlik Doğrulama (REST) ====================
def _post_json(url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _anon_sign_up():
    url = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + FIREBASE_API_KEY
    return _post_json(url, {"returnSecureToken": True})


def _refresh_id_token(refresh_token):
    url = "https://securetoken.googleapis.com/v1/token?key=" + FIREBASE_API_KEY
    body = "grant_type=refresh_token&refresh_token=" + urllib.parse.quote(refresh_token)
    req = urllib.request.Request(url, data=body.encode("utf-8"), method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _ensure_token():
    """Geçerli bir idToken döndürür; gerekirse yeniler, hiç yoksa yeni anonim
    hesap açar. Aynı anonim kimlik (refresh token diskte saklandığı için)
    uygulama yeniden başlatılsa bile korunur."""
    global _id_token, _refresh_token, _token_expiry
    now = time.time()
    if _id_token and now < _token_expiry - 60:
        return _id_token
    if _refresh_token:
        try:
            r = _refresh_id_token(_refresh_token)
            _id_token = r["id_token"]
            _refresh_token = r["refresh_token"]
            _token_expiry = now + int(r.get("expires_in", 3600))
            _save_auth_cache()
            return _id_token
        except Exception:
            pass  # refresh token geçersizleşmiş olabilir — aşağıda yeniden anonim giriş denenir
    r = _anon_sign_up()
    _id_token = r["idToken"]
    _refresh_token = r["refreshToken"]
    _token_expiry = now + int(r.get("expiresIn", 3600))
    _save_auth_cache()
    return _id_token


# ==================== Firestore REST — belge yazma ====================
def _fs_value(v):
    """Python değerini Firestore REST 'Value' JSON biçimine çevirir."""
    if v is None:
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    return {"stringValue": str(v)}


def _doc_id(oda, tarih):
    """oda+tarih kombinasyonu için deterministik belge ID'si — aynı gün
    tekrar gönderilirse ÜZERİNE YAZAR (kopya belge oluşmaz), SQLite'daki
    PRIMARY KEY(oda,tarih) ile birebir aynı benzersizlik kuralı."""
    safe_oda = "".join(ch if (ch.isalnum() or ch in "-_") else "_" for ch in str(oda))
    return safe_oda + "__" + str(tarih)


def _doc_url(oda, tarih):
    return (
        "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/"
        "farms/%s/hasat_tarti/%s" % (FIREBASE_PROJECT_ID, FARM_CODE, _doc_id(oda, tarih))
    )


def _push_one(item):
    token = _ensure_token()
    url = _doc_url(item["oda"], item["tarih"])
    # "_op" gibi dahili alanlar Firestore'a yazılmaz (yalnız gerçek veri alanları)
    fields = {k: _fs_value(v) for k, v in item.items() if not k.startswith("_")}
    body = json.dumps({"fields": fields}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="PATCH")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
        resp.read()


def _delete_one(item):
    """Bir oda+tarih dokümanını Firestore'dan siler. Doküman zaten yoksa
    Firestore hata döndürmez (silme idempotenttir)."""
    token = _ensure_token()
    url = _doc_url(item["oda"], item["tarih"])
    req = urllib.request.Request(url, method="DELETE")
    req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
        resp.read()


# ==================== Arka plan işçi thread'i ====================
def _worker_loop():
    global _son_hata, _gonderilen_sayisi
    while True:
        with _lock:
            items = list(_queue)
        if items:
            kalanlar = []
            for item in items:
                try:
                    if item.get("_op") == "delete":
                        _delete_one(item)
                    else:
                        _push_one(item)
                    with _lock:
                        _gonderilen_sayisi += 1
                    _son_hata = None
                except Exception as e:
                    kalanlar.append(item)  # başarısız — kuyrukta kalsın, sonraki turda tekrar denenir
                    _son_hata = str(e)
            with _lock:
                _queue[:] = kalanlar
                _save_queue()
        time.sleep(_RETRY_SANIYE)


def _ensure_worker():
    global _worker_started
    if _worker_started:
        return
    _worker_started = True
    _load_auth_cache()
    with _lock:
        _load_queue()  # diskteki bekleyen kayıtları BURADA, thread başlamadan/enqueue
                        # eklemeden ÖNCE (senkron, ana thread'de) oku — worker'ın kendi
                        # içinde okuması, henüz kaydedilmemiş bir enqueue ile YARIŞA girip
                        # az önce eklenen kaydı sessizce kaybedebilirdi.
    t = threading.Thread(target=_worker_loop, name="firestore-sync", daemon=True)
    t.start()


# ==================== Dışa açık API ====================
def enqueue_hasat_sync(oda, tarih, tur, flas, ana90, kestane, duble, dokme, ikinci,
                        gelis_tarihi="", firma="", tonaj=0):
    """set_tarti_detay ile AYNI ANDA çağrılır — bu satırı Üretim Takip'in
    izlediği Firestore koleksiyonuna (farms/merkez/hasat_tarti) kuyruğa alır.
    Asla exception fırlatmaz; ağ yoksa/başarısız olursa sessizce kuyrukta kalır
    ve arka planda periyodik olarak tekrar denenir.

    firma/tonaj (kompost_detay'dan): Üretim Takip tarafı SADECE kendi
    oda kaydında bu alanlar BOŞSA doldurur — elle girilmiş bilgiyi asla
    ezmez. Amaç: Hasat Takip'ten otomatik oluşan (elle oda açılmayan)
    kayıtlarda da Firma Analizi'nin çalışabilmesi (bkz. index.html
    hasatTartiEksikOdalariOlustur / hasatTartiSenkronEt)."""
    try:
        _ensure_worker()
        item = {
            "oda": str(oda), "tarih": str(tarih), "tur": int(tur or 1), "flas": int(flas or 1),
            "ana90": float(ana90 or 0), "kestane": float(kestane or 0),
            "duble": float(duble or 0), "dokme": float(dokme or 0), "ikinci": float(ikinci or 0),
            "gelis_tarihi": str(gelis_tarihi or ""),
            "firma": str(firma or ""), "tonaj": float(tonaj or 0),
        }
        with _lock:
            for i, existing in enumerate(_queue):
                if existing.get("oda") == item["oda"] and existing.get("tarih") == item["tarih"]:
                    _queue[i] = item
                    break
            else:
                _queue.append(item)
            _save_queue()
    except Exception:
        pass  # kuyruğa dahi alınamadıysa sessizce vazgeç — ana kayıt zaten yapıldı


def enqueue_hasat_delete(oda, tarih):
    """oda_kaydi_sil ile AYNI ANDA çağrılır — bu oda+tarih dokümanının Üretim
    Takip'in izlediği Firestore koleksiyonundan (farms/merkez/hasat_tarti)
    SİLİNMESİNİ kuyruğa alır. Böylece masaüstünde silinen bir kayıt web'de de
    kaybolur. Asla exception fırlatmaz; ağ yoksa sessizce kuyrukta kalır ve
    arka planda tekrar denenir.

    Aynı oda+tarih için kuyrukta bekleyen bir YAZMA (veya eski silme) varsa
    onun yerini alır — böylece 'ekle sonra sil' veya 'sil sonra ekle' sırasında
    her zaman EN SON işlem gönderilir."""
    try:
        _ensure_worker()
        item = {"_op": "delete", "oda": str(oda), "tarih": str(tarih)}
        with _lock:
            for i, existing in enumerate(_queue):
                if existing.get("oda") == item["oda"] and existing.get("tarih") == item["tarih"]:
                    _queue[i] = item
                    break
            else:
                _queue.append(item)
            _save_queue()
    except Exception:
        pass  # kuyruğa dahi alınamadıysa sessizce vazgeç — yerel silme zaten yapıldı


def son_durum():
    """İsteğe bağlı: UI'da küçük bir 'senkron: 3 bekliyor' göstergesi için."""
    with _lock:
        return {
            "bekleyen": len(_queue),
            "gonderilen": _gonderilen_sayisi,
            "son_hata": _son_hata,
        }
