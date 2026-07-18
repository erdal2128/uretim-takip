"use strict";
// memDataNormalizeVeGoc() zincirindeki (index.html:918) göç/normalizasyon
// fonksiyonları — HER soğuk açılışta otomatik çalışıp memData'yı sessizce
// değiştirir ve bir şey değiştiyse hemen saveData() tetikler. Yorumlarında
// "idempotent" diye işaretlenenler için asıl garanti edilmesi gereken şey
// TAM OLARAK BUDUR: aynı veri üzerinde ikinci çalıştırma hiçbir şey
// değiştirmemeli (false dönmeli, veriyi tekrar bozmamalı).
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var fns = loadFns([
  "atamaParse",
  "gorevlerMukerrerleriBirlestir",
  "firmaCasingBirlestir",
  "todayISO",
  "kompostIndirmeGeriyeDonukDoldur",
  "gunlukEskiNotlariAyir",
  "sulamaIptalDegistirNotlariniTekille"
]);
var gorevlerMukerrerleriBirlestir = fns.gorevlerMukerrerleriBirlestir;
var firmaCasingBirlestir = fns.firmaCasingBirlestir;
var kompostIndirmeGeriyeDonukDoldur = fns.kompostIndirmeGeriyeDonukDoldur;
var gunlukEskiNotlariAyir = fns.gunlukEskiNotlariAyir;
var sulamaIptalDegistirNotlariniTekille = fns.sulamaIptalDegistirNotlariniTekille;

// ---------- gorevlerMukerrerleriBirlestir ----------

test("gorevlerMukerrerleriBirlestir: aynı tarih+başlık+done'a sahip mükerrer görevler tek satırda birleşir, atamalar birleşir", function () {
  var d = {
    gorevler: [
      { id: "g1", tarih: "2026-01-01", baslik: "Oda boşaltma", done: false, atama: "grup:ic" },
      { id: "g2", tarih: "2026-01-01", baslik: "Oda boşaltma", done: false, atama: "grup:dis" },
      { id: "g3", tarih: "2026-01-01", baslik: "Oda boşaltma", done: false, atama: "grup:ic" }
    ],
    cycles: []
  };
  var degisti = gorevlerMukerrerleriBirlestir(d);
  assert.equal(degisti, true);
  assert.equal(d.gorevler.length, 1);
  assert.deepEqual(atamaParse(d.gorevler[0].atama).sort(), ["grup:dis", "grup:ic"]);
  // Firestore'daki fazlalık dokümanları silmek için kuyruğa alınmalı
  assert.deepEqual(d._gorevMukerrerSil.sort(), ["g2", "g3"]);
});

test("gorevlerMukerrerleriBirlestir: farklı done durumundaki görevler ayrı kalır", function () {
  var d = {
    gorevler: [
      { id: "g1", tarih: "2026-01-01", baslik: "X", done: false, atama: "" },
      { id: "g2", tarih: "2026-01-01", baslik: "X", done: true, atama: "" }
    ],
    cycles: []
  };
  var degisti = gorevlerMukerrerleriBirlestir(d);
  assert.equal(degisti, false);
  assert.equal(d.gorevler.length, 2);
});

test("gorevlerMukerrerleriBirlestir: idempotent — mükerrer kalmayınca ikinci çalıştırma hiçbir şey değiştirmez", function () {
  var d = {
    gorevler: [
      { id: "g1", tarih: "2026-01-01", baslik: "Oda boşaltma", done: false, atama: "grup:ic" },
      { id: "g2", tarih: "2026-01-01", baslik: "Oda boşaltma", done: false, atama: "grup:dis" }
    ],
    cycles: []
  };
  gorevlerMukerrerleriBirlestir(d);
  var oncekiUzunluk = d.gorevler.length;
  var ikinciDegisti = gorevlerMukerrerleriBirlestir(d);
  assert.equal(ikinciDegisti, false);
  assert.equal(d.gorevler.length, oncekiUzunluk);
});

test("gorevlerMukerrerleriBirlestir: oda görevleri (c.odaGorevleri) için de aynı şekilde birleşir", function () {
  var d = {
    gorevler: [],
    cycles: [
      { id: "c1", odaGorevleri: [
        { tarih: "2026-01-01", is: "Yıkama", done: false, atama: "kisi:ali" },
        { tarih: "2026-01-01", is: "Yıkama", done: false, atama: "kisi:veli" }
      ] }
    ]
  };
  var degisti = gorevlerMukerrerleriBirlestir(d);
  assert.equal(degisti, true);
  assert.equal(d.cycles[0].odaGorevleri.length, 1);
});

// ---------- firmaCasingBirlestir ----------

test("firmaCasingBirlestir: firmalar listesindeki büyük/küçük harf farklı yazımlar tek yazıma indirgenir (liste sırası korunur)", function () {
  var d = { settings: { firmalar: ["Özdal", "özdal", "Mantar A.Ş."] }, cycles: [] };
  var degisti = firmaCasingBirlestir(d);
  assert.equal(degisti, true);
  assert.deepEqual(d.settings.firmalar, ["Özdal", "Mantar A.Ş."]);
});

test("firmaCasingBirlestir: odalardaki (c.kompostFirma) farklı yazım, firmalar listesindeki kanonik yazıma göre düzeltilir", function () {
  var d = {
    settings: { firmalar: ["Özdal"] },
    cycles: [{ id: "c1", kompostFirma: "özdal" }]
  };
  var degisti = firmaCasingBirlestir(d);
  assert.equal(degisti, true);
  assert.equal(d.cycles[0].kompostFirma, "Özdal");
});

test("firmaCasingBirlestir: idempotent — zaten temiz veride ikinci çalıştırma hiçbir şey değiştirmez", function () {
  var d = {
    settings: { firmalar: ["Özdal", "Mantar A.Ş."] },
    cycles: [{ id: "c1", kompostFirma: "Özdal" }]
  };
  firmaCasingBirlestir(d);
  var ikinciDegisti = firmaCasingBirlestir(d);
  assert.equal(ikinciDegisti, false);
});

// ---------- kompostIndirmeGeriyeDonukDoldur ----------

test("kompostIndirmeGeriyeDonukDoldur: geçmiş tarihli geliş, eksik kompostIndirme'yi geriye dönük doldurur", function () {
  var d = { cycles: [{ id: "c1", gelisTarihi: "2000-01-01" }] };
  var degisti = kompostIndirmeGeriyeDonukDoldur(d);
  assert.equal(degisti, true);
  assert.equal(d.cycles[0].kompostIndirme.tarih, "2000-01-01");
});

test("kompostIndirmeGeriyeDonukDoldur: ileri tarihli (henüz gelmemiş) kompost geriye dönük doldurulmaz (regresyon: 'yarın kompost gelecek' gizlenmesin)", function () {
  var d = { cycles: [{ id: "c1", gelisTarihi: "2999-01-01" }] };
  var degisti = kompostIndirmeGeriyeDonukDoldur(d);
  assert.equal(degisti, false);
  assert.equal(d.cycles[0].kompostIndirme, undefined);
});

test("kompostIndirmeGeriyeDonukDoldur: boşaltılmış (bosaltimTarihi dolu) odalara dokunulmaz", function () {
  var d = { cycles: [{ id: "c1", gelisTarihi: "2000-01-01", bosaltimTarihi: "2000-06-01" }] };
  var degisti = kompostIndirmeGeriyeDonukDoldur(d);
  assert.equal(degisti, false);
});

test("kompostIndirmeGeriyeDonukDoldur: idempotent — zaten dolu kompostIndirme'ye dokunmaz", function () {
  var d = { cycles: [{ id: "c1", gelisTarihi: "2000-01-01", kompostIndirme: { tarih: "1999-12-31" } }] };
  var degisti = kompostIndirmeGeriyeDonukDoldur(d);
  assert.equal(degisti, false);
  assert.equal(d.cycles[0].kompostIndirme.tarih, "1999-12-31");
});

// ---------- gunlukEskiNotlariAyir ----------

test("gunlukEskiNotlariAyir: 'yapıldı/ertelendi' gibi protokol notları sulama'dan islemNot'a taşınır", function () {
  var d = { cycles: [{ id: "c1", gunluk: [{ tarih: "2026-01-01", sulama: "Toprak serimi yapıldı" }] }] };
  var degisti = gunlukEskiNotlariAyir(d);
  assert.equal(degisti, true);
  var g = d.cycles[0].gunluk[0];
  assert.equal(g.sulama, "");
  assert.equal(g.islemNot, "Toprak serimi yapıldı");
});

test("gunlukEskiNotlariAyir: 'değişiklik:' / 'yarın için değişiklik:' notları TAŞINMAZ, tamamen silinir", function () {
  var d = { cycles: [{ id: "c1", gunluk: [{ tarih: "2026-01-01", sulama: "Yarın için değişiklik: su azaltılacak" }] }] };
  var degisti = gunlukEskiNotlariAyir(d);
  assert.equal(degisti, true);
  var g = d.cycles[0].gunluk[0];
  assert.equal(g.sulama, "");
  assert.equal(g.islemNot, undefined);
});

test("gunlukEskiNotlariAyir: gerçek sulama/ilaç metni (desenle eşleşmeyen) olduğu gibi kalır", function () {
  var d = { cycles: [{ id: "c1", gunluk: [{ tarih: "2026-01-01", sulama: "2 litre ilaçlama yapıldı, sonra 1 litre daha" }] }] };
  gunlukEskiNotlariAyir(d);
  // "yapıldı" ile bitmediği için (arada devam eden metin var) taşınmamalı
  assert.equal(d.cycles[0].gunluk[0].sulama, "2 litre ilaçlama yapıldı, sonra 1 litre daha");
});

test("gunlukEskiNotlariAyir: idempotent — zaten temiz kayıtlarda ikinci çalıştırma hiçbir şey değiştirmez", function () {
  var d = { cycles: [{ id: "c1", gunluk: [{ tarih: "2026-01-01", sulama: "Toprak serimi yapıldı" }] }] };
  gunlukEskiNotlariAyir(d);
  var ikinciDegisti = gunlukEskiNotlariAyir(d);
  assert.equal(ikinciDegisti, false);
});

// ---------- sulamaIptalDegistirNotlariniTekille ----------

test("sulamaIptalDegistirNotlariniTekille: aynı ön eke sahip tekrarlardan sadece sonuncusu kalır", function () {
  var d = {
    cycles: [{
      id: "c1", gunluk: [{
        tarih: "2026-01-01",
        islemNot: "Sulama iptal edildi (neden: yağmur) — Ali (tel1) · Sulama iptal edildi (neden: yağmur) — Ali (tel1)"
      }]
    }]
  };
  var degisti = sulamaIptalDegistirNotlariniTekille(d);
  assert.equal(degisti, true);
  var parcalar = d.cycles[0].gunluk[0].islemNot.split(" · ");
  assert.equal(parcalar.length, 1);
});

test("sulamaIptalDegistirNotlariniTekille: sahipsiz çıplak tarih parçaları (eski ayraç hatası) sulama notu varsa atılır", function () {
  var d = {
    cycles: [{
      id: "c1", gunluk: [{
        tarih: "2026-01-01",
        islemNot: "Sulama iptal edildi (neden: yağmur) — Ali · 18.07.2026 14:30"
      }]
    }]
  };
  var degisti = sulamaIptalDegistirNotlariniTekille(d);
  assert.equal(degisti, true);
  assert.equal(d.cycles[0].gunluk[0].islemNot, "Sulama iptal edildi (neden: yağmur) — Ali");
});

test("sulamaIptalDegistirNotlariniTekille: ilgisiz notlara dokunmaz", function () {
  var d = { cycles: [{ id: "c1", gunluk: [{ tarih: "2026-01-01", islemNot: "Genel bir not" }] }] };
  var degisti = sulamaIptalDegistirNotlariniTekille(d);
  assert.equal(degisti, false);
  assert.equal(d.cycles[0].gunluk[0].islemNot, "Genel bir not");
});

test("sulamaIptalDegistirNotlariniTekille: idempotent — tekilleştirilmiş veride ikinci çalıştırma hiçbir şey değiştirmez", function () {
  var d = {
    cycles: [{
      id: "c1", gunluk: [{
        tarih: "2026-01-01",
        islemNot: "Sulama iptal edildi (neden: yağmur) — Ali (tel1) · Sulama iptal edildi (neden: yağmur) — Ali (tel1)"
      }]
    }]
  };
  sulamaIptalDegistirNotlariniTekille(d);
  var ikinciDegisti = sulamaIptalDegistirNotlariniTekille(d);
  assert.equal(ikinciDegisti, false);
});
