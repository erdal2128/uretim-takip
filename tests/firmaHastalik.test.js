"use strict";
// 🦠 Hastalık (15) firma karnesi kategorisi — kullanıcı isteği: çoğu hastalık/
// zararlı kompost/firma kaynaklı olduğu için firma değerlendirmesine ayrı bir
// kategori olarak eklendi. Her odanın hastalık puanı oda tarafındaki
// _puanHastalik (0-20) ile hesaplanıp firma genelinde ortalanır, 15'e ölçeklenir.
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var SHIM = ["function _kalem(delta, aciklama){ return {delta:delta, aciklama:aciklama}; }"].join("\n");
var fns = loadFns(["hastalikSiddet", "_puanHastalik", "_firmaHastalik"], SHIM);
var _firmaHastalik = fns._firmaHastalik;

function C(turler) {
  return { hastalikKayitlar: (turler || []).map(function (t, i) { return { tur: t, tarih: "2026-07-0" + (i + 1) }; }) };
}

test("hiç döngü yoksa nötr tam puan (15)", function () {
  var r = _firmaHastalik([]);
  assert.equal(r.maks, 15);
  assert.equal(r.puan, 15);
});

test("hastalıksız firma → 15 (tüm odalar temiz)", function () {
  var r = _firmaHastalik([C([]), C([]), C([])]);
  assert.equal(r.puan, 15);
  assert.equal(r.hastalikliOda, 0);
  assert.match(r.kalemler[0].aciklama, /hastalık\/zararlı kaydı yok/);
});

test("tek odada yeşil küf (oda puanı 15/20) → (15/20)*15 = 11.25 → 11.3 (yuvarlama)", function () {
  // 1 oda hastalıklı (yeşil küf −5 → 15). (15/20)*15=11.25; 1 ondalığa yuvarlanır → 11.3
  var r = _firmaHastalik([C(["Yeşil küf (Trichoderma)"])]);
  assert.equal(r.puan, 11.3);
  assert.equal(r.hastalikliOda, 1);
});

test("iki oda ortalanır: biri temiz (20) biri yeşil küf (15) → ort 17.5 → (17.5/20)*15 = 13.1", function () {
  var r = _firmaHastalik([C([]), C(["Yeşil küf (Trichoderma)"])]);
  // ort oda puanı = (20+15)/2 = 17.5 ; (17.5/20)*15 = 13.125 → 13.1
  assert.equal(r.puan, 13.1);
  assert.equal(r.hastalikliOda, 1);
});

test("4+ türlü oda (oda puanı 0) firma puanını sert düşürür", function () {
  // tek döngü, 4 farklı tür → oda 0 → firma 0
  var r = _firmaHastalik([C(["Yeşil küf (Trichoderma)", "Bakteriyel leke", "Beyaz alçı", "Sinek (Sciarid/Phorid)"])]);
  assert.equal(r.puan, 0);
});

test("kalem, hastalık görülen oda sayısını ve türleri listeler", function () {
  var r = _firmaHastalik([C(["Yeşil küf (Trichoderma)"]), C(["Beyaz alçı"]), C([])]);
  assert.equal(r.hastalikliOda, 2);
  assert.match(r.kalemler[0].aciklama, /2\/3 odada/);
  assert.match(r.kalemler[0].aciklama, /Yeşil küf|Beyaz alçı/);
});
