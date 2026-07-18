"use strict";
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var fns = loadFns(["cmpDate", "mergeArr", "mergeFlatObj", "mergeCycle"]);
var mergeArr = fns.mergeArr;
var mergeFlatObj = fns.mergeFlatObj;
var mergeCycle = fns.mergeCycle;

function keyId(e) { return e.id; }

test("mergeArr: iki tarafta da olmayan öğeler korunur (hiçbiri kaybolmaz)", function () {
  var local = [{ id: "a", v: 1 }];
  var remote = [{ id: "b", v: 2 }];
  var out = mergeArr(local, remote, keyId, false);
  var ids = out.map(function (e) { return e.id; });
  assert.deepEqual(ids.sort(), ["a", "b"]);
});

test("mergeArr: aynı key'de preferLocal=false ise remote kazanır", function () {
  var local = [{ id: "a", v: "local" }];
  var remote = [{ id: "a", v: "remote" }];
  var out = mergeArr(local, remote, keyId, false);
  assert.equal(out.length, 1);
  assert.equal(out[0].v, "remote");
});

test("mergeArr: aynı key'de preferLocal=true ise local kazanır", function () {
  var local = [{ id: "a", v: "local" }];
  var remote = [{ id: "a", v: "remote" }];
  var out = mergeArr(local, remote, keyId, true);
  assert.equal(out.length, 1);
  assert.equal(out[0].v, "local");
});

test("mergeArr: null/undefined diziler çökmeden boş sonuç üretir", function () {
  assert.deepEqual(mergeArr(null, undefined, keyId, false), []);
  assert.deepEqual(mergeArr(undefined, null, keyId, true), []);
});

test("mergeFlatObj: iki taraftaki farklı anahtarların TÜMÜ korunur", function () {
  var local = { done1: true };
  var remote = { done2: true };
  var out = mergeFlatObj(local, remote, false);
  assert.deepEqual(out, { done1: true, done2: true });
});

test("mergeFlatObj: çakışan anahtarda preferLocal tarafı kazanır", function () {
  var local = { adim1: "yerel-deger" };
  var remote = { adim1: "uzak-deger" };
  assert.equal(mergeFlatObj(local, remote, true).adim1, "yerel-deger");
  assert.equal(mergeFlatObj(local, remote, false).adim1, "uzak-deger");
});

test("mergeFlatObj: null objelerle çağrıldığında çökmez", function () {
  assert.deepEqual(mergeFlatObj(null, null, false), {});
  assert.deepEqual(mergeFlatObj(null, { a: 1 }, false), { a: 1 });
});

test("mergeCycle: taraflardan biri yoksa diğeri aynen döner", function () {
  var c = { id: "x", gunluk: [], hava: [], hasat: [] };
  assert.equal(mergeCycle(null, c), c);
  assert.equal(mergeCycle(c, null), c);
});

test("mergeCycle: daha yeni _at'lı taraf temel alınır, ama iki taraftaki done anahtarları da korunur (regresyon: eskiden geç senkron olan cihazın işareti kayboluyordu)", function () {
  var local = {
    id: "c1", _at: "2026-01-02T10:00:00.000Z",
    gunluk: [], hava: [], hasat: [], odaGorevleri: [],
    done: { adim1: true }, doneSon: {}, ertele: {}, adimDetay: {}, kontrolKarar: {}, tempAck: {}
  };
  var remote = {
    id: "c1", _at: "2026-01-01T10:00:00.000Z",
    gunluk: [], hava: [], hasat: [], odaGorevleri: [],
    done: { adim2: true }, doneSon: {}, ertele: {}, adimDetay: {}, kontrolKarar: {}, tempAck: {}
  };
  var merged = mergeCycle(local, remote);
  // Yerel daha yeni olduğu için temel obje yerelden gelir, AMA remote'un
  // işaretlediği adim2 de kaybolmamalı.
  assert.equal(merged.done.adim1, true);
  assert.equal(merged.done.adim2, true);
  assert.equal(merged._at, local._at);
});

test("mergeCycle: hasat kayıtları id'ye göre dedupe edilir, id olmayanlar tarih+tip+kasa+personel ile ayrıştırılır", function () {
  var local = {
    id: "c1", _at: "2026-01-01T10:00:00.000Z",
    gunluk: [], hava: [],
    hasat: [{ id: "h1", tarih: "2026-01-01", tip: "normal", kg: 10 }],
    odaGorevleri: [], done: {}, doneSon: {}, ertele: {}, adimDetay: {}, kontrolKarar: {}, tempAck: {}
  };
  var remote = {
    id: "c1", _at: "2026-01-02T10:00:00.000Z",
    gunluk: [], hava: [],
    hasat: [{ id: "h1", tarih: "2026-01-01", tip: "normal", kg: 12 }, { tarih: "2026-01-02", tip: "kestane", kasa: "k1", personel: "p1", kg: 5 }],
    odaGorevleri: [], done: {}, doneSon: {}, ertele: {}, adimDetay: {}, kontrolKarar: {}, tempAck: {}
  };
  var merged = mergeCycle(local, remote);
  assert.equal(merged.hasat.length, 2);
  var h1 = merged.hasat.filter(function (h) { return h.id === "h1"; })[0];
  // remote daha yeni (_at) olduğu için preferLocal=false, h1 remote'daki kg=12 olmalı
  assert.equal(h1.kg, 12);
});

test("mergeCycle: tempAck iç içe objelerde de her iki taraf korunur", function () {
  var local = {
    id: "c1", _at: "2026-01-01T10:00:00.000Z",
    gunluk: [], hava: [], hasat: [], odaGorevleri: [],
    done: {}, doneSon: {}, ertele: {}, adimDetay: {}, kontrolKarar: {},
    tempAck: { "2026-01-01": { p1: true } }
  };
  var remote = {
    id: "c1", _at: "2026-01-02T10:00:00.000Z",
    gunluk: [], hava: [], hasat: [], odaGorevleri: [],
    done: {}, doneSon: {}, ertele: {}, adimDetay: {}, kontrolKarar: {},
    tempAck: { "2026-01-01": { p2: true } }
  };
  var merged = mergeCycle(local, remote);
  assert.deepEqual(merged.tempAck["2026-01-01"], { p1: true, p2: true });
});
