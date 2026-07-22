"use strict";
// _sulamaZincirKaydir: sulama "Ertele" zincirleme (domino) kaydırma. Bir sulama
// ileri kayınca, sınır tarihinden (dahil) itibaren etkin tarihi olan TÜM su/ilaç
// adımlarının c.ertele offset'ine +1 ekler. Tekrarlı (tekrarBitisRef), olay/uyarı
// adımları ve sınır tarihinden ÖNCEKİ sulamalar etkilenmez. haricIdxSet'teki
// adımlar (birincil, ayrıca taşınan) atlanır (çift kaydırma önlenir).
// İptal Et bu fonksiyonu hiç çağırmaz — burada test edilmez.
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

// protokolTarih'i shim'liyoruz: her adımın "base" tarihi step.__base alanından gelsin.
// getProtokol'ü de test protokolünü döndürecek şekilde shim'liyoruz.
var SHIM = [
  "var __PROTO=[];",
  "function getProtokol(){ return __PROTO; }",
  "function protokolTarih(c, step){ return step && step.__base ? step.__base : null; }"
].join("\n");

var fns = loadFns(["parseISO", "addDays", "cmpDate", "daysBetween", "_sulamaZincirKaydir"], SHIM);
var _sulamaZincirKaydir = fns._sulamaZincirKaydir;

function setProto(arr) { global.__PROTO = arr; }

test("sınırdan itibaren su/ilaç adımları +1 kayar, öncekiler kaymaz", function () {
  // hava+4, +5, +6 sulamaları (temsili tarihler)
  setProto([
    { tip: "su",   __base: "2026-07-20" }, // önceki — kaymamalı
    { tip: "ilac", __base: "2026-07-22" }, // sınır günü — kaymalı
    { tip: "su",   __base: "2026-07-23" }, // sonraki — kaymalı
    { tip: "ilac", __base: "2026-07-24" }  // sonraki — kaymalı
  ]);
  var c = { ertele: {} };
  var etkilenen = _sulamaZincirKaydir(c, "2026-07-22", {});
  assert.deepEqual(etkilenen, [1, 2, 3]);
  assert.equal(c.ertele["p0"], undefined);   // önceki dokunulmadı
  assert.equal(c.ertele["p1"], 1);
  assert.equal(c.ertele["p2"], 1);
  assert.equal(c.ertele["p3"], 1);
});

test("olay/uyarı ve tekrarlı adımlar etkilenmez", function () {
  setProto([
    { tip: "olay", __base: "2026-07-23" },                      // olay — atla
    { tip: "uyari", __base: "2026-07-23" },                     // uyarı — atla
    { tip: "ilac", __base: "2026-07-23", tekrarBitisRef: "x" }, // tekrarlı — atla
    { tip: "su",   __base: "2026-07-23" }                       // gerçek sulama — kaymalı
  ]);
  var c = { ertele: {} };
  var etkilenen = _sulamaZincirKaydir(c, "2026-07-22", {});
  assert.deepEqual(etkilenen, [3]);
  assert.equal(c.ertele["p3"], 1);
  assert.equal(c.ertele["p0"], undefined);
});

test("haricIdxSet'teki birincil adım tekrar kaydırılmaz", function () {
  setProto([
    { tip: "su",   __base: "2026-07-22" }, // birincil (hariç) — zaten taşındı
    { tip: "su",   __base: "2026-07-23" }  // sonraki — kaymalı
  ]);
  var c = { ertele: { p0: 1 } }; // birincil zaten +1
  var etkilenen = _sulamaZincirKaydir(c, "2026-07-23", { p0: true });
  assert.deepEqual(etkilenen, [1]);
  assert.equal(c.ertele["p0"], 1); // değişmedi (hariç)
  assert.equal(c.ertele["p1"], 1);
});

test("mevcut offset üstüne ekler (tekrar ertelemede birikir)", function () {
  setProto([{ tip: "su", __base: "2026-07-20" }]); // base+2 offset = 2026-07-22
  var c = { ertele: { p0: 2 } };
  _sulamaZincirKaydir(c, "2026-07-22", {});
  assert.equal(c.ertele["p0"], 3);
});
