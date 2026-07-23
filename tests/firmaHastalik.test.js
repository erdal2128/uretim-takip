"use strict";
// 🦠 Hastalık (15) firma karnesi kategorisi — kullanıcı isteği: çoğu hastalık/
// zararlı kompost/firma kaynaklı olduğu için firma değerlendirmesine ayrı bir
// kategori olarak eklendi. Ölçü: HASTALIK GÖRÜLME ORANI = hastalıklı oda /
// toplam oda. Puan = 15 × (1 − oran). Şiddet firma seviyesinde ölçüye girmez
// (oda tarafındaki _puanHastalik zaten şiddeti değerlendirir); firma için soru
// "kompost ne SIKLIKLA hastalık çıkarıyor".
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var SHIM = ["function _kalem(delta, aciklama){ return {delta:delta, aciklama:aciklama}; }"].join("\n");
var fns = loadFns(["_firmaHastalik"], SHIM);
var _firmaHastalik = fns._firmaHastalik;

function C(turler) {
  return { hastalikKayitlar: (turler || []).map(function (t, i) { return { tur: t, tarih: "2026-07-0" + (i + 1) }; }) };
}

test("hiç döngü yoksa nötr tam puan (15)", function () {
  var r = _firmaHastalik([]);
  assert.equal(r.maks, 15);
  assert.equal(r.puan, 15);
  assert.equal(r.oran, null);
});

test("hastalıksız firma → oran 0 → 15", function () {
  var r = _firmaHastalik([C([]), C([]), C([])]);
  assert.equal(r.puan, 15);
  assert.equal(r.hastalikliOda, 0);
  assert.equal(r.oran, 0);
  assert.match(r.kalemler[0].aciklama, /hiçbirinde hastalık\/zararlı kaydı yok/);
});

test("tek odalı firma, o oda hastalıklı → oran %100 → 0", function () {
  var r = _firmaHastalik([C(["Yeşil küf (Trichoderma)"])]);
  assert.equal(r.oran, 1);
  assert.equal(r.puan, 0);
  assert.equal(r.hastalikliOda, 1);
});

test("4 odanın 1'inde hastalık → oran %25 → 15×0.75 = 11.25 → 11.3", function () {
  var r = _firmaHastalik([C(["Yeşil küf (Trichoderma)"]), C([]), C([]), C([])]);
  assert.equal(r.oran, 0.25);
  assert.equal(r.puan, 11.3); // 15*0.75=11.25 → 1 ondalık yuvarlama
  assert.equal(r.hastalikliOda, 1);
});

test("2 odanın 1'inde hastalık → oran %50 → 7.5", function () {
  var r = _firmaHastalik([C([]), C(["Beyaz alçı"])]);
  assert.equal(r.oran, 0.5);
  assert.equal(r.puan, 7.5);
});

test("şiddet değil sıklık: hafif (sinek) tek oda ile ağır (yeşil küf) tek oda aynı oranı verir", function () {
  var hafif = _firmaHastalik([C(["Sinek (Sciarid/Phorid)"]), C([])]);
  var agir = _firmaHastalik([C(["Yeşil küf (Trichoderma)"]), C([])]);
  assert.equal(hafif.puan, agir.puan); // ikisi de %50 → 7.5
});

test("bir odada birden çok tür yine tek 'hastalıklı oda' sayılır (oran oda bazlı)", function () {
  var r = _firmaHastalik([C(["Yeşil küf (Trichoderma)", "Beyaz alçı", "Sinek (Sciarid/Phorid)"]), C([])]);
  assert.equal(r.hastalikliOda, 1);
  assert.equal(r.oran, 0.5);
  assert.equal(r.puan, 7.5);
});

test("kalem görülme oranını ve türleri listeler", function () {
  var r = _firmaHastalik([C(["Yeşil küf (Trichoderma)"]), C(["Beyaz alçı"]), C([])]);
  assert.equal(r.hastalikliOda, 2);
  assert.match(r.kalemler[0].aciklama, /görülme oranı %67/); // 2/3 = %66.7 → %67
  assert.match(r.kalemler[0].aciklama, /2\/3 oda/);
});
