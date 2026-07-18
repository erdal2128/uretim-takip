"use strict";
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var normalizeOda = loadFns(["normalizeOda"]).normalizeOda;

test("normalizeOda: farklı yazım biçimleri aynı sonuca normalize olur", function () {
  assert.equal(normalizeOda("A-7"), "A-7");
  assert.equal(normalizeOda("a7"), "A-7");
  assert.equal(normalizeOda("A 7"), "A-7");
  assert.equal(normalizeOda("a-7"), "A-7");
  assert.equal(normalizeOda(" A-7 "), "A-7");
});

test("normalizeOda: Türkçe büyük harf katlama (İ/Ş/Ç/Ğ/Ü/Ö)", function () {
  assert.equal(normalizeOda("ı-7"), "I-7");
});

test("normalizeOda: boş/null/undefined girdi çökmeden boş string döner", function () {
  assert.equal(normalizeOda(""), "");
  assert.equal(normalizeOda(null), "");
  assert.equal(normalizeOda(undefined), "");
});

test("normalizeOda: harf+sayı deseniyle eşleşmeyen girdide sadece boşluklar silinir", function () {
  assert.equal(normalizeOda("Depo"), "DEPO");
  assert.equal(normalizeOda("Ana Kompost"), "ANAKOMPOST");
});

test("normalizeOda: sayısal kısımdaki baştaki sıfırlar atılır (parseInt)", function () {
  assert.equal(normalizeOda("A-07"), "A-7");
});
