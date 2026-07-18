"use strict";
// stageAtDate: bir odanın belirli bir tarihteki üretim aşamasını (Kuluçka /
// Toprak / Misel gelişim / Pimleme / Hasat...) belirler — odaPerformans'ın
// dönem ağırlıklandırmasının (_donemAgirlikKatsayisi) ve Bugün ekranındaki
// rozetlerin temelini oluşturur. getSet() üzerinden loadData()'ya bağımlı
// olduğu için loadFns shim mekanizması kullanılıyor. Hasat sonrası aşamalar
// (hasatAsama'ya bağlı) bu testlerin kapsamı dışında bırakıldı — o fonksiyon
// ayrı, daha geniş bir bağımlılık zinciri (HASAT_PLAN/öğrenilmiş referans)
// gerektiriyor.
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var SHIM = "function loadData(){ return global.__TEST_DATA; }";

var fns = loadFns(
  ["numParse", "todayISO", "parseISO", "cmpDate", "daysBetween", "addDays", "getSet", "_mhDates", "phaseCls", "stageAtDate", "_donemAgirlikKatsayisi"],
  SHIM
);
var stageAtDate = fns.stageAtDate;
var _donemAgirlikKatsayisi = fns._donemAgirlikKatsayisi;

function setTestData(settings) {
  global.__TEST_DATA = { settings: settings || {} };
}

test("stageAtDate: boşaltılmış odada tarihten bağımsız her zaman 'Boşaltıldı'", function () {
  setTestData();
  var c = { bosaltimTarihi: "2026-01-01", gelisTarihi: "2025-01-01" };
  assert.equal(stageAtDate(c, "2025-01-01").t, "Boşaltıldı");
});

test("stageAtDate: donemManuel set edilmişse her zaman onu döndürür", function () {
  setTestData();
  var c = { donemManuel: "Özel Durum" };
  assert.equal(stageAtDate(c, "2026-01-01").t, "Özel Durum");
});

test("stageAtDate: toprak tarihinden önce 'Kuluçka dönemi'", function () {
  setTestData({ offToprak: 13 });
  var c = { gelisTarihi: "2026-01-01" }; // tahmini toprak: 2026-01-14
  assert.equal(stageAtDate(c, "2026-01-13").t, "Kuluçka dönemi");
});

test("stageAtDate: toprak ile tırmık arası 'Toprak dönemi'", function () {
  setTestData({ offToprak: 13, offTirmik: 7 });
  var c = { gelisTarihi: "2026-01-01" }; // toprak: 01-14, tırmık: 01-21
  assert.equal(stageAtDate(c, "2026-01-14").t, "Toprak dönemi");
  assert.equal(stageAtDate(c, "2026-01-20").t, "Toprak dönemi");
});

test("stageAtDate: gerçek toprakTarihi girilmişse tahmine göre değil ona göre hesaplanır", function () {
  setTestData({ offToprak: 13, offTirmik: 7 });
  var c = { gelisTarihi: "2026-01-01", toprakTarihi: "2026-01-05" };
  assert.equal(stageAtDate(c, "2026-01-05").t, "Toprak dönemi");
});

test("stageAtDate: hava başlamadan önce (tırmıktan sonra) '1. Misel gelişim'", function () {
  setTestData({ offToprak: 13, offTirmik: 7 });
  var c = { gelisTarihi: "2026-01-01", toprakTarihi: "2026-01-14", tirmikTarihi: "2026-01-21" };
  assert.equal(stageAtDate(c, "2026-01-25").t, "1. Misel gelişim");
});

test("stageAtDate: kayıtlı bir havaBaslangic YOKSA, tahmini hava tarihi geçmiş olsa bile '1. Misel gelişim'de kalır (regresyon: kullanıcı yanlışlıkla girip silerse oda hava başladı gibi görünmemeli)", function () {
  setTestData({ offToprak: 13, offTirmik: 7, offHava: 10 });
  var c = { gelisTarihi: "2026-01-01", toprakTarihi: "2026-01-14" };
  // tahmini hava: toprak+10 = 2026-01-24, çok ileri bir tarihte bile hava başlamamış sayılmalı
  assert.equal(stageAtDate(c, "2026-03-01").t, "1. Misel gelişim");
});

test("stageAtDate: havaBaslangic'tan sonraki günlere göre 2. Misel gelişim / Pimleme / Bezelye / Ceviz aşamaları", function () {
  setTestData({ offToprak: 13, offTirmik: 7 });
  var c = { gelisTarihi: "2026-01-01", toprakTarihi: "2026-01-14", tirmikTarihi: "2026-01-21", havaBaslangic: "2026-02-01" };
  assert.equal(stageAtDate(c, "2026-02-01").t, "2. Misel gelişim"); // hd=0
  assert.equal(stageAtDate(c, "2026-02-06").t, "2. Misel gelişim"); // hd=5
  assert.equal(stageAtDate(c, "2026-02-07").t, "Pimleme dönemi"); // hd=6
  assert.equal(stageAtDate(c, "2026-02-09").t, "Pimleme dönemi"); // hd=8
  assert.equal(stageAtDate(c, "2026-02-10").t, "Bezelye boyutu"); // hd=9
  assert.equal(stageAtDate(c, "2026-02-11").t, "Ceviz boyutu"); // hd=10
});

test("_donemAgirlikKatsayisi: erken dönemler daha ağır cezalandırılır (kuluçka > toprak > misel > pimleme > bezelye/ceviz > hasat)", function () {
  assert.equal(_donemAgirlikKatsayisi("Kuluçka dönemi"), 1.4);
  assert.equal(_donemAgirlikKatsayisi("Toprak dönemi"), 1.2);
  assert.equal(_donemAgirlikKatsayisi("1. Misel gelişim"), 1.0);
  assert.equal(_donemAgirlikKatsayisi("2. Misel gelişim"), 0.8);
  assert.equal(_donemAgirlikKatsayisi("Pimleme dönemi"), 0.6);
  assert.equal(_donemAgirlikKatsayisi("Bezelye boyutu"), 0.5);
  assert.equal(_donemAgirlikKatsayisi("Ceviz boyutu"), 0.5);
});

test("_donemAgirlikKatsayisi: 'Hasat'/'Flaş' içeren herhangi bir etiket en düşük ağırlığı alır", function () {
  assert.equal(_donemAgirlikKatsayisi("Hasat F1 · 3. gün"), 0.3);
  assert.equal(_donemAgirlikKatsayisi("2. Flaş hazırlığı"), 0.3);
});

test("_donemAgirlikKatsayisi: bilinmeyen/boş etiket varsayılan 1.0 alır", function () {
  assert.equal(_donemAgirlikKatsayisi("Tanımsız Aşama"), 1.0);
  assert.equal(_donemAgirlikKatsayisi(undefined), 1.0);
});
