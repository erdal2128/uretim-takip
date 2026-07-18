"use strict";
// Verim/kg-ton hesaplama fonksiyonları (verimOzet, firmaOrtalamaKgTon,
// filoOrtalamaKgTon, tahminiVerim) loadData()/getSet() üzerinden global
// memData'ya bağımlı. loadData() burada test verisini döndüren bir shim ile
// değiştirilir — asıl hesaplama fonksiyonları index.html'den değiştirilmeden
// alınır.
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var SHIM = "function loadData(){ return global.__TEST_DATA; }";

var fns = loadFns(
  ["numParse", "esc", "getSet", "verimOzet", "tumTamamlananDongu", "firmaOrtalamaKgTon", "filoOrtalamaKgTon", "tahminiVerim"],
  SHIM
);
var verimOzet = fns.verimOzet;
var firmaOrtalamaKgTon = fns.firmaOrtalamaKgTon;
var filoOrtalamaKgTon = fns.filoOrtalamaKgTon;
var tahminiVerim = fns.tahminiVerim;

function setTestData(d) {
  if (!d.settings) d.settings = {};
  global.__TEST_DATA = d;
}

// ---------- verimOzet ----------

test("verimOzet: kestane ve normal kasalar ayrı toplanır, kg kasaAgirlik ile hesaplanır", function () {
  setTestData({ settings: { kasaAgirlik: 3 } });
  var c = {
    hasat: [{ tip: "normal", kasa: "10" }, { tip: "normal", kasa: "5" }, { tip: "kestane", kasa: "2" }],
    tonaj: "1000", alanM2: "100"
  };
  var v = verimOzet(c);
  assert.equal(v.normal, 15);
  assert.equal(v.kestane, 2);
  assert.equal(v.toplam, 17);
  assert.equal(v.kg, 17 * 3);
  assert.equal(v.ton, 1);
  assert.equal(v.verim, 17);
  assert.equal(v.kgTon, 51);
  assert.equal(v.kgM2, 51 / 100);
});

test("verimOzet: kasaAgirlik ayarlanmamışsa varsayılan 3 kullanılır (getSet)", function () {
  setTestData({ settings: {} });
  var c = { hasat: [{ tip: "normal", kasa: "1" }], tonaj: "1000" };
  var v = verimOzet(c);
  assert.equal(v.kg, 3);
});

test("verimOzet: tonaj 0 ya da girilmemişse verim/kgTon null döner (sıfıra bölme yok)", function () {
  setTestData({ settings: { kasaAgirlik: 3 } });
  var c = { hasat: [{ tip: "normal", kasa: "10" }], tonaj: "" };
  var v = verimOzet(c);
  assert.equal(v.ton, 0);
  assert.equal(v.verim, null);
  assert.equal(v.kgTon, null);
});

test("verimOzet: alanM2 boşsa kgM2 null döner", function () {
  setTestData({ settings: { kasaAgirlik: 3 } });
  var c = { hasat: [{ tip: "normal", kasa: "10" }], tonaj: "1000" };
  var v = verimOzet(c);
  assert.equal(v.kgM2, null);
});

test("verimOzet: hasat kaydı yoksa hepsi 0/null döner, çökmez", function () {
  setTestData({ settings: {} });
  var v = verimOzet({});
  assert.equal(v.toplam, 0);
  assert.equal(v.kg, 0);
  assert.equal(v.verim, null);
});

// ---------- firmaOrtalamaKgTon / filoOrtalamaKgTon ----------

test("firmaOrtalamaKgTon: sadece tamamlanmış (boşaltılmış + hasatlı) ve o firmaya ait odalar ortalamaya girer", function () {
  setTestData({
    settings: { kasaAgirlik: 3 },
    cycles: [
      { bosaltimTarihi: "2026-01-01", kompostFirma: "Özdal", tonaj: "1000", hasat: [{ tip: "normal", kasa: "10" }] },
      { bosaltimTarihi: "2026-01-01", kompostFirma: "Özdal", tonaj: "1000", hasat: [{ tip: "normal", kasa: "20" }] },
      { bosaltimTarihi: "2026-01-01", kompostFirma: "Başka Firma", tonaj: "1000", hasat: [{ tip: "normal", kasa: "5" }] },
      { kompostFirma: "Özdal", tonaj: "1000", hasat: [{ tip: "normal", kasa: "999" }] }, // boşaltılmamış, sayılmaz
      { bosaltimTarihi: "2026-01-01", kompostFirma: "Özdal", tonaj: "1000", hasat: [] } // hasatsız, sayılmaz
    ]
  });
  var r = firmaOrtalamaKgTon("Özdal");
  assert.equal(r.n, 2);
  assert.equal(r.ort, (30 + 60) / 2); // (10*3)/1 ve (20*3)/1 kg/ton
});

test("firmaOrtalamaKgTon: eşleşen kayıt yoksa null döner", function () {
  setTestData({ settings: {}, cycles: [] });
  assert.equal(firmaOrtalamaKgTon("Yok Firma"), null);
});

test("filoOrtalamaKgTon: firmadan bağımsız tüm tamamlanmış odaların ortalaması", function () {
  setTestData({
    settings: { kasaAgirlik: 3 },
    cycles: [
      { bosaltimTarihi: "2026-01-01", kompostFirma: "A", tonaj: "1000", hasat: [{ tip: "normal", kasa: "10" }] },
      { bosaltimTarihi: "2026-01-01", kompostFirma: "B", tonaj: "1000", hasat: [{ tip: "normal", kasa: "20" }] }
    ]
  });
  var r = filoOrtalamaKgTon();
  assert.equal(r.n, 2);
  assert.equal(r.ort, 45);
});

// ---------- tahminiVerim ----------

test("tahminiVerim: boşaltılmış odalar için tahmin yapılmaz (zaten gerçek verim var)", function () {
  setTestData({ settings: {}, cycles: [] });
  assert.equal(tahminiVerim({ bosaltimTarihi: "2026-01-01", tonaj: "1000" }), null);
});

test("tahminiVerim: tonaj girilmemiş/0 ise tahmin yapılmaz", function () {
  setTestData({ settings: {}, cycles: [] });
  assert.equal(tahminiVerim({ tonaj: "" }), null);
  assert.equal(tahminiVerim({ tonaj: "0" }), null);
});

test("tahminiVerim: firma geçmişi yeterliyse (n>=2) firma ortalaması, değilse filo geneli kullanılır", function () {
  setTestData({
    settings: { kasaAgirlik: 3 },
    cycles: [
      { bosaltimTarihi: "2026-01-01", kompostFirma: "Özdal", tonaj: "1000", hasat: [{ tip: "normal", kasa: "10" }] },
      { bosaltimTarihi: "2026-01-01", kompostFirma: "Özdal", tonaj: "1000", hasat: [{ tip: "normal", kasa: "10" }] }
    ]
  });
  var r = tahminiVerim({ kompostFirma: "Özdal", tonaj: "2000" });
  assert.ok(r.kaynak.indexOf("firma ortalaması") === 0);
  assert.equal(r.kg, 30 * 2); // 30 kg/ton * 2 ton

  var r2 = tahminiVerim({ kompostFirma: "Bilinmeyen Firma", tonaj: "2000" });
  assert.ok(r2.kaynak.indexOf("filo geneli") === 0);
});

test("tahminiVerim: hiç tamamlanmış oda yoksa null döner", function () {
  setTestData({ settings: {}, cycles: [] });
  assert.equal(tahminiVerim({ kompostFirma: "Özdal", tonaj: "1000" }), null);
});
