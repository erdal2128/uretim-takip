"use strict";
// hasatTartiSenkronEt: Hasat Takip (masaüstü) → Üretim Takip senkronunda gelen
// hasat_tarti kayıtlarını döngünün c.hasat dizisine yansıtır. Bu testler özellikle
// SİLME senkronunu kapsar: bir kayıt _hasatTarti'dan kalkınca (onSnapshot 'removed'),
// o kaydın c.hasat'taki yetim source:"hasat_tarti_sync" satırı da budanmalı — aksi
// halde silinen hasat, raporlarda ve Haftalık Hasat Tahmini'nde (hasatBaslangic
// çıpası) yaşamaya devam ediyordu (kullanıcı raporu: "odadan gitti ama raporlamada
// duruyor"). Elle girilen satırlar (source != hasat_tarti_sync) ASLA budanmamalı.
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var SHIM = [
  "var HASAT_SENKRON_DEVRE_DISI_TUR=[];",
  "function firmaAdiCanonik(x){return x;}",
  "function touchCycle(c){c._touched=true;}"
].join("\n");

var fns = loadFns(
  ["numParse", "cmpDate", "normalizeOda", "hasatTartiGetir", "_hasatTartiIndexOlustur", "hasatTartiSenkronEt"],
  SHIM
);
var hasatTartiSenkronEt = fns.hasatTartiSenkronEt;
var _hasatTartiIndexOlustur = fns._hasatTartiIndexOlustur;
var hasatTartiGetir = fns.hasatTartiGetir;

test("silinen kayıt: yetim hasat_tarti_sync satırı budanır, manuel satır korunur", function () {
  var c = { oda: "A-1", tur: 18, hasat: [
    { tarih: "2026-07-22", tip: "normal", kasa: "75.5", source: "hasat_tarti_sync", sourceKey: "A-1__2026-07-22" },
    { tarih: "2026-07-20", tip: "normal", kasa: "10", source: "manuel" }
  ] };
  // _hasatTarti artık A-1__18 için boş (kayıt Firestore'dan silindi)
  var degisti = hasatTartiSenkronEt(c, {});
  assert.equal(degisti, true);
  assert.equal(c.hasat.length, 1);
  assert.equal(c.hasat[0].source, "manuel");
});

test("kayıt hâlâ varken: yetim budanmaz, kasa değeri güncellenir", function () {
  var c = { oda: "A-1", tur: 18, hasat: [
    { tarih: "2026-07-22", tip: "normal", kasa: "75.5", source: "hasat_tarti_sync", sourceKey: "A-1__2026-07-22" }
  ] };
  var idx = { "A-1__18": [{ oda: "A-1", tarih: "2026-07-22", ana90: 80, kestane: 0, duble: 0, dokme: 0, ikinci: 0 }] };
  hasatTartiSenkronEt(c, idx);
  assert.equal(c.hasat.length, 1);
  assert.equal(c.hasat[0].kasa, "80");
});

test("tüm kayıtlar silinince (kayitlar boş) tüm sync satırları budanır", function () {
  var c = { oda: "B-5", tur: 3, hasat: [
    { tarih: "2026-07-22", tip: "normal", kasa: "20", source: "hasat_tarti_sync", sourceKey: "B-5__2026-07-22" },
    { tarih: "2026-07-23", tip: "kestane", kasa: "5", source: "hasat_tarti_sync", sourceKey: "B-5__2026-07-23" }
  ] };
  var degisti = hasatTartiSenkronEt(c, {});
  assert.equal(degisti, true);
  assert.equal(c.hasat.length, 0);
});

// ── ODA YAZIM FARKI SENKRONU ──────────────────────────────────────────────
// Hasat Takip (masaüstü) oda adını firestore_sync.py'de HAM olarak (str(oda))
// gönderir; Üretim Takip cycle'ının c.oda'sı elle girilir. İki program aynı
// odayı farklı yazarsa ("A 1" ↔ "A-1", "a-1", "A-01", "A1") eşleşme normalize
// edilmeden yapıldığında senkron SESSİZCE kopuyordu — hasat verisi hiç gelmez,
// firma/tonaj hiç dolmaz. Eşleştirme normalizeOda üzerinden yapılmalı (kardeş
// fonksiyon hasatTartiEksikOdalariOlustur zaten normalizeOda kullanıyor).
function idxFor(store) {
  global.window = global;
  global._hasatTarti = store;
  return _hasatTartiIndexOlustur();
}
[
  ["boşluklu vs tireli", "A 1"],
  ["küçük harf vs büyük", "a-1"],
  ["sıfır dolgulu vs sade", "A-01"],
  ["tiresiz vs tireli", "A1"]
].forEach(function (kv) {
  test("oda yazım farkı senkronu: " + kv[0] + " → A-1 eşleşir", function () {
    var idx = idxFor({ r1: { oda: kv[1], tur: 18, tarih: "2026-07-22", ana90: 80, kestane: 0, duble: 0, dokme: 0, ikinci: 0, firma: "X Firma", tonaj: 20 } });
    var c = { oda: "A-1", tur: 18, hasat: [] };
    var degisti = hasatTartiSenkronEt(c, idx);
    assert.equal(degisti, true, "senkron değişiklik üretmeli");
    assert.equal(c.hasat.length, 1, "hasat satırı eklenmeli");
    assert.equal(c.hasat[0].kasa, "80");
    assert.equal(c.kompostFirma, "X Firma", "firma boşsa senkrondan dolmalı");
  });
});

test("hasatTartiGetir: oda yazımı farklı olsa da (Oda Detayı kartı) eşleşir", function () {
  global.window = global;
  global._hasatTarti = { r1: { oda: "a 1", tur: 18, tarih: "2026-07-22", ana90: 40 } };
  var out = hasatTartiGetir("A-1", 18);
  assert.equal(out.length, 1);
});

test("oda yazımı normalize eşdeğer DEĞİLSE eşleşmez (farklı odalara sızmaz)", function () {
  var idx = idxFor({ r1: { oda: "B-2", tur: 18, tarih: "2026-07-22", ana90: 80, kestane: 0, duble: 0, dokme: 0, ikinci: 0 } });
  var c = { oda: "A-1", tur: 18, hasat: [] };
  var degisti = hasatTartiSenkronEt(c, idx);
  assert.equal(degisti, false);
  assert.equal(c.hasat.length, 0);
});
