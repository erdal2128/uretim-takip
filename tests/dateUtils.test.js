"use strict";
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var fns = loadFns(["fmtDate", "parseISO", "cmpDate", "daysBetween", "addDays", "addMonths"]);
var fmtDate = fns.fmtDate;
var parseISO = fns.parseISO;
var cmpDate = fns.cmpDate;
var daysBetween = fns.daysBetween;
var addDays = fns.addDays;
var addMonths = fns.addMonths;

test("fmtDate: ISO -> gg.aa.yyyy", function () {
  assert.equal(fmtDate("2026-07-18"), "18.07.2026");
});

test("fmtDate: boş/bozuk girdi çökmeden geri döner", function () {
  assert.equal(fmtDate(""), "—");
  assert.equal(fmtDate(null), "—");
  assert.equal(fmtDate("bozuk"), "bozuk");
});

test("parseISO: geçerli tarihi UTC epoch ms'e çevirir", function () {
  assert.equal(parseISO("2026-01-01"), Date.UTC(2026, 0, 1));
});

test("parseISO: bozuk/eksik girdide null döner (çökmez)", function () {
  assert.equal(parseISO(""), null);
  assert.equal(parseISO(null), null);
  assert.equal(parseISO("2026-01"), null);
  assert.equal(parseISO("yil-ay-gun"), null);
});

test("cmpDate: string karşılaştırmasıyla sıralar", function () {
  assert.equal(cmpDate("2026-01-01", "2026-01-02"), -1);
  assert.equal(cmpDate("2026-01-02", "2026-01-01"), 1);
  assert.equal(cmpDate("2026-01-01", "2026-01-01"), 0);
});

test("cmpDate: boş/undefined değerlerle çökmez", function () {
  assert.equal(cmpDate(undefined, "2026-01-01"), -1);
  assert.equal(cmpDate("2026-01-01", undefined), 1);
});

test("daysBetween: iki tarih arası gün farkı", function () {
  assert.equal(daysBetween("2026-01-01", "2026-01-11"), 10);
  assert.equal(daysBetween("2026-01-11", "2026-01-01"), -10);
});

test("daysBetween: bozuk tarihte null döner", function () {
  assert.equal(daysBetween("bozuk", "2026-01-01"), null);
});

test("addDays: gün ekler ve ay/yıl sınırını doğru taşırır", function () {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("addMonths: ay ekler, taşan gün sayısını JS Date normalize eder (örn. 31 Ocak + 1 ay -> 3 Mart, 28 Şubat değil)", function () {
  // 31 Ocak + 1 ay: Şubat'ta 31. gün yok, Date bunu Mart'a taşırır.
  assert.equal(addMonths("2026-01-31", 1), "2026-03-03");
  assert.equal(addMonths("2026-01-15", 1), "2026-02-15");
  assert.equal(addMonths("2026-01-15", 12), "2027-01-15");
});

test("addMonths/addDays: bozuk tarihte null döner", function () {
  assert.equal(addMonths("bozuk", 1), null);
  assert.equal(addDays("bozuk", 1), null);
});
