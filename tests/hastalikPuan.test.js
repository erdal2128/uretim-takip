"use strict";
// 🦠 Hastalık Faktörleri (20) puanlama kategorisi — kullanıcı isteğiyle eski
// "Risk Faktörleri" kategorisi salt hastalık/zararlı değerlendirmesine
// dönüştürüldü. Kurallar:
//   • Kapsam: döngü boyunca TÜM kayıtlar (14 gün penceresi YOK).
//   • Benzersiz tür sayısı >=4 → KOŞULSUZ 0.
//   • <4 tür → her benzersiz türün şiddet puanı (hastalikSiddet) 20'den düşülür.
//   • Şiddet: ağır küfler 5, orta 3, hafif 2; bilinmeyen tür 3 (orta).
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var SHIM = ["function _kalem(delta, aciklama){ return {delta:delta, aciklama:aciklama}; }"].join("\n");
var fns = loadFns(["hastalikSiddet", "_puanHastalik"], SHIM);
var hastalikSiddet = fns.hastalikSiddet;
var _puanHastalik = fns._puanHastalik;

// ---------- hastalikSiddet ----------
test("hastalikSiddet: ağır küfler 5 puan", function () {
  ["Yeşil küf (Trichoderma)", "Dactylium (Örümcek ağı hastalığı)", "Mycogone (Islak kabarcık)", "Verticillium"].forEach(function (t) {
    assert.equal(hastalikSiddet(t), 5, t);
  });
});
test("hastalikSiddet: orta 3, hafif 2", function () {
  assert.equal(hastalikSiddet("Bakteriyel leke"), 3);
  assert.equal(hastalikSiddet("Diğer mantar hastalığı"), 3);
  assert.equal(hastalikSiddet("Beyaz alçı"), 2);
  assert.equal(hastalikSiddet("Keçeleşme"), 2);
  assert.equal(hastalikSiddet("Sinek (Sciarid/Phorid)"), 2);
});
test("hastalikSiddet: bilinmeyen/serbest tür → orta (3)", function () {
  assert.equal(hastalikSiddet("Adı olmayan bir şey"), 3);
});

// ---------- _puanHastalik ----------
test("kayıt yoksa tam puan (20)", function () {
  var r = _puanHastalik({});
  assert.equal(r.maks, 20);
  assert.equal(r.puan, 20);
  assert.equal(r.kalemler.length, 0);
  assert.equal(r.key, "hastalik");
});

test("tek tür (yeşil küf) → 20-5=15", function () {
  var r = _puanHastalik({ hastalikKayitlar: [{ tur: "Yeşil küf (Trichoderma)", tarih: "2026-07-01" }] });
  assert.equal(r.puan, 15);
  assert.equal(r.kalemler.length, 1);
  assert.equal(r.kalemler[0].delta, -5);
});

test("üç tür (yeşil küf 5 + bakteriyel 3 + beyaz alçı 2) → 20-10=10", function () {
  var r = _puanHastalik({ hastalikKayitlar: [
    { tur: "Yeşil küf (Trichoderma)", tarih: "2026-07-01" },
    { tur: "Bakteriyel leke", tarih: "2026-07-05" },
    { tur: "Beyaz alçı", tarih: "2026-07-10" }
  ] });
  assert.equal(r.puan, 10);
  assert.equal(r.kalemler.length, 3);
});

test("aynı türün tekrarı tek sayılır (yeşil küf x3) → 15", function () {
  var r = _puanHastalik({ hastalikKayitlar: [
    { tur: "Yeşil küf (Trichoderma)", tarih: "2026-07-01" },
    { tur: "Yeşil küf (Trichoderma)", tarih: "2026-07-02" },
    { tur: "Yeşil küf (Trichoderma)", tarih: "2026-07-03" }
  ] });
  assert.equal(r.puan, 15);
  assert.equal(r.kalemler.length, 1);
});

test("KATI KURAL: 4 farklı tür → koşulsuz 0 (şiddetten bağımsız)", function () {
  // 4 hafif tür bile (2+2+2+2=8, normalde 12 kalırdı) 4+ kuralıyla 0 olur
  var r = _puanHastalik({ hastalikKayitlar: [
    { tur: "Beyaz alçı", tarih: "2026-07-01" },
    { tur: "Keçeleşme", tarih: "2026-07-02" },
    { tur: "Sinek (Sciarid/Phorid)", tarih: "2026-07-03" },
    { tur: "Bakteriyel leke", tarih: "2026-07-04" }
  ] });
  assert.equal(r.puan, 0);
  assert.equal(r.kalemler.length, 1);
  assert.equal(r.kalemler[0].delta, -20);
  assert.match(r.kalemler[0].aciklama, /4\+ tür/);
});

test("ağırlıklı toplam 20'yi aşarsa 0'da taban (3 ağır küf: 15 → 5)", function () {
  var r = _puanHastalik({ hastalikKayitlar: [
    { tur: "Yeşil küf (Trichoderma)", tarih: "2026-07-01" },
    { tur: "Dactylium (Örümcek ağı hastalığı)", tarih: "2026-07-02" },
    { tur: "Mycogone (Islak kabarcık)", tarih: "2026-07-03" }
  ] });
  assert.equal(r.puan, 5); // 20-15
});

test("kapsam döngü boyunca: eski tarihli kayıt da sayılır (14 gün filtresi yok)", function () {
  var r = _puanHastalik({ hastalikKayitlar: [{ tur: "Yeşil küf (Trichoderma)", tarih: "2020-01-01" }] });
  assert.equal(r.puan, 15);
});
