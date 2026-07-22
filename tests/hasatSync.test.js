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

var fns = loadFns(["numParse", "hasatTartiSenkronEt"], SHIM);
var hasatTartiSenkronEt = fns.hasatTartiSenkronEt;

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
