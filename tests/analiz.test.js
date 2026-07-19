"use strict";
// Oda Analizi puanlama motoru (_puan*, _kritikHatalarTespit) — Raporlar > Oda
// Analizi ekranını besleyen kural tabanlı puanlama/uyarı mantığı, önceden hiç
// test edilmiyordu. getProtokol() burada basit, sabit bir test protokolüyle
// shim'lenir (gerçek protokol/referans-tarihi çözümleme zinciri — protokolTarih/
// protokolReferansTarihi/protokolRolIdx — kasıtlı olarak kapsam dışı bırakıldı,
// bu testlerin odağı puanlama/eşik mantığı). KOMPOST_*/ODA_MAX sabitleri
// index.html'deki gerçek değerleriyle (var bildirimi olduğu için loadFns ile
// çekilemiyor) birebir aynı tutulmalı.
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var SHIM = [
  "function loadData(){ return global.__TEST_DATA; }",
  "var ODA_MAX=21, KOMPOST_IDEAL_MAX=26, KOMPOST_IDEAL_MIN=24, KOMPOST_KRITIK_ALT=21, KOMPOST_KRITIK_UST=28, KOMPOST_TEHLIKELI=30, KOMPOST_TEHLIKE_ALT=18;",
  "function getProtokol(){ return global.__TEST_PROTOKOL || []; }"
].join("\n");

var fns = loadFns(
  [
    "numParse", "todayISO", "parseISO", "cmpDate", "daysBetween", "addDays", "getSet",
    "_mhDates", "phaseCls", "stageAtDate", "_donemAgirlikKatsayisi", "havaHedef", "havaHedefSatiri",
    "_kalem", "protokolAdimAlanKey", "adimYapilmaTarihi", "_kritikHatalarTespit", "_puanIklim"
  ],
  SHIM
);
var _kritikHatalarTespit = fns._kritikHatalarTespit;
var _puanIklim = fns._puanIklim;

function setTestData(settings) {
  global.__TEST_DATA = { settings: settings || {} };
}
function setTestProtokol(steps) {
  global.__TEST_PROTOKOL = steps;
}

// ---------- _kritikHatalarTespit ----------

test("_kritikHatalarTespit: veri yokken boş dizi döner, çökmez", function () {
  setTestData();
  setTestProtokol([]);
  assert.deepEqual(_kritikHatalarTespit({}), []);
});

test("_kritikHatalarTespit: kompost art arda 3+ gün tehlikeli sıcaklıkta kalırsa uyarı üretir", function () {
  setTestData();
  setTestProtokol([]);
  var c = {
    gunluk: [
      { tarih: "2026-01-01", kompostC: "31" },
      { tarih: "2026-01-02", kompostC: "32" },
      { tarih: "2026-01-03", kompostC: "31" }
    ]
  };
  var out = _kritikHatalarTespit(c);
  assert.ok(out.some(function (m) { return /art arda 3 gün tehlikeli/.test(m); }), out.join(" | "));
});

test("_kritikHatalarTespit: tehlikeli seri 3 günden kısa sürerse (aralarda normal ölçüm) uyarı üretmez", function () {
  setTestData();
  setTestProtokol([]);
  var c = {
    gunluk: [
      { tarih: "2026-01-01", kompostC: "31" },
      { tarih: "2026-01-02", kompostC: "25" },
      { tarih: "2026-01-03", kompostC: "31" }
    ]
  };
  var out = _kritikHatalarTespit(c);
  assert.ok(!out.some(function (m) { return /tehlikeli/.test(m); }), out.join(" | "));
});

test("_kritikHatalarTespit: havaya başlama planlanandan 5+ gün geç yapılmışsa uyarır", function () {
  setTestData({ offHava: 10, offTirmik: 7 });
  setTestProtokol([]);
  // beklenen hava = tirmik + (offHava-offTirmik) = tirmik + 3
  var c = { tirmikTarihi: "2026-01-01", havaBaslangic: "2026-01-09" }; // beklenen: tırmık+3=01-04, gerçek 01-09 -> 5 gün geç
  var out = _kritikHatalarTespit(c);
  assert.ok(out.some(function (m) { return /planlanandan 5 gün geç/.test(m); }), out.join(" | "));
});

test("_kritikHatalarTespit: hava başlaması 5 günden az geç olursa uyarmaz", function () {
  setTestData({ offHava: 10, offTirmik: 7 });
  setTestProtokol([]);
  var c = { tirmikTarihi: "2026-01-01", havaBaslangic: "2026-01-05" }; // 4 gün geç
  var out = _kritikHatalarTespit(c);
  assert.ok(!out.some(function (m) { return /havaya başlama/i.test(m); }), out.join(" | "));
});

test("_kritikHatalarTespit: toprak planlanandan 3+ gün erken serilmişse uyarır", function () {
  setTestData({ offToprak: 13 });
  setTestProtokol([]);
  var c = { gelisTarihi: "2026-01-01", toprakTarihi: "2026-01-10" }; // beklenen 01-14, 4 gün erken
  var out = _kritikHatalarTespit(c);
  assert.ok(out.some(function (m) { return /4 gün erken/.test(m); }), out.join(" | "));
});

test("_kritikHatalarTespit: amonyak bildirimiyle aynı/ardışık günde protokol işlemi yapılmışsa uyarır", function () {
  setTestData();
  setTestProtokol([{ ref: "gelis", gun: 5, tip: "olay", txt: "1000 lt su" }]);
  var c = {
    gunluk: [{ tarih: "2026-01-10", amonyak: "Var" }],
    adimDetay: { p0: { tarih: "2026-01-10" } }
  };
  var out = _kritikHatalarTespit(c);
  assert.ok(out.some(function (m) { return /Amonyak kokusu/.test(m); }), out.join(" | "));
});

test("_kritikHatalarTespit: amonyak günüyle protokol işlemi çakışmıyorsa (>1 gün ara) uyarmaz", function () {
  setTestData();
  setTestProtokol([{ ref: "gelis", gun: 5, tip: "olay", txt: "1000 lt su" }]);
  var c = {
    gunluk: [{ tarih: "2026-01-10", amonyak: "Var" }],
    adimDetay: { p0: { tarih: "2026-01-20" } }
  };
  var out = _kritikHatalarTespit(c);
  assert.ok(!out.some(function (m) { return /Amonyak kokusu/.test(m); }), out.join(" | "));
});

// ---------- _puanIklim ----------

test("_puanIklim: ölçüm yokken tam puan (25) döner, ceza/kalem yok", function () {
  setTestData();
  var r = _puanIklim({});
  assert.equal(r.puan, 25);
  assert.equal(r.maks, 25);
  assert.deepEqual(r.kalemler, []);
});

test("_puanIklim: art arda tehlikeli kompost sıcaklığı puanı düşürür (ceza 11 ile sınırlı)", function () {
  setTestData();
  // c.gelisTarihi/toprakTarihi verilmediği için tüm günler "Kuluçka dönemi" (kat=1.4) sayılır
  var c = {
    gunluk: [
      { tarih: "2026-01-01", kompostC: "31" },
      { tarih: "2026-01-02", kompostC: "31" },
      { tarih: "2026-01-03", kompostC: "31" },
      { tarih: "2026-01-04", kompostC: "31" },
      { tarih: "2026-01-05", kompostC: "31" }
    ]
  };
  var r = _puanIklim(c);
  var kalem = r.kalemler.filter(function (k) { return /tehlikeli kompost/.test(k.aciklama); })[0];
  assert.ok(kalem, r.kalemler.map(function(k){return k.aciklama;}).join(" | "));
  assert.equal(kalem.delta, -11); // 5 gün * 3 * 1.4 = 21, min(11,21) = 11
  assert.equal(r.puan, 25 - 11);
});

test("_puanIklim: 7+ gün üst üste ideal kompost sıcaklığı bonus puan verir", function () {
  setTestData();
  var gunluk = [];
  for (var i = 1; i <= 7; i++) {
    gunluk.push({ tarih: "2026-01-0" + i, kompostC: "25" }); // ideal aralık 24-26
  }
  var r = _puanIklim({ gunluk: gunluk });
  var kalem = r.kalemler.filter(function (k) { return /ideal kompost/.test(k.aciklama); })[0];
  assert.ok(kalem, r.kalemler.map(function(k){return k.aciklama;}).join(" | "));
  assert.equal(kalem.delta, 2);
  assert.equal(r.puan, 25); // 25 + 2, 25 tavanında kırpılır
});

test("_puanIklim: havadan önce oda sıcaklığı ODA_MAX'ı aşarsa puan kırar", function () {
  setTestData();
  var c = { gunluk: [{ tarih: "2026-01-01", odaC: "23" }] }; // ODA_MAX=21
  var r = _puanIklim(c);
  var kalem = r.kalemler.filter(function (k) { return /oda sıcaklığı/.test(k.aciklama); })[0];
  assert.ok(kalem, r.kalemler.map(function(k){return k.aciklama;}).join(" | "));
  assert.ok(kalem.delta < 0);
});

test("_puanIklim: ani kompost sıcaklığı sıçraması (≥3°) puan kırar (ceza 3 ile sınırlı)", function () {
  setTestData();
  var c = {
    gunluk: [
      { tarih: "2026-01-01", kompostC: "25" },
      { tarih: "2026-01-02", kompostC: "29" }, // +4, ani değişim
      { tarih: "2026-01-03", kompostC: "25" }  // -4, ani değişim
    ]
  };
  var r = _puanIklim(c);
  var kalem = r.kalemler.filter(function (k) { return /ani kompost/.test(k.aciklama); })[0];
  assert.ok(kalem, r.kalemler.map(function(k){return k.aciklama;}).join(" | "));
  assert.equal(kalem.delta, -2);
});

test("_puanIklim: puan hiçbir zaman 0'ın altına inmez", function () {
  setTestData();
  var gunluk = [];
  for (var i = 1; i <= 20; i++) {
    gunluk.push({ tarih: "2026-01-" + (i < 10 ? "0" + i : i), kompostC: "35", odaC: "30" });
  }
  var r = _puanIklim({ gunluk: gunluk });
  assert.ok(r.puan >= 0);
});
