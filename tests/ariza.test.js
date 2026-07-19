"use strict";
var test = require("node:test");
var assert = require("node:assert/strict");
var loadFns = require("./helpers/loadFns").loadFns;

var arizaWhatsappLink = loadFns(["arizaWhatsappLink"]).arizaWhatsappLink;

test("arizaWhatsappLink: mesaj oda/başlık/açıklamayı içerir ve wa.me linkinde URL-encode edilir", function () {
  var link = arizaWhatsappLink({ oda: "A-7", baslik: "Pompa arızası", aciklama: "Su akmıyor" });
  assert.ok(link.indexOf("https://wa.me/?text=") === 0);
  var decoded = decodeURIComponent(link.slice("https://wa.me/?text=".length));
  assert.ok(decoded.indexOf("A-7") >= 0);
  assert.ok(decoded.indexOf("Pompa arızası") >= 0);
  assert.ok(decoded.indexOf("Su akmıyor") >= 0);
});

test("arizaWhatsappLink: oda boşsa oda satırı eklenmez, çökmez", function () {
  var link = arizaWhatsappLink({ baslik: "Jeneratör sesi geliyor" });
  var decoded = decodeURIComponent(link.slice("https://wa.me/?text=".length));
  assert.ok(decoded.indexOf(" — ") === -1);
  assert.ok(decoded.indexOf("Jeneratör sesi geliyor") >= 0);
});

test("arizaWhatsappLink: açıklama boşsa açıklama satırı eklenmez", function () {
  var linkAciklamali = arizaWhatsappLink({ baslik: "X", aciklama: "detay" });
  var linkAciklamasiz = arizaWhatsappLink({ baslik: "X" });
  assert.ok(decodeURIComponent(linkAciklamali).indexOf("detay") >= 0);
  assert.ok(decodeURIComponent(linkAciklamasiz).indexOf("\ndetay") === -1);
});

test("arizaWhatsappLink: özel karakterler (&, %, Türkçe) güvenli şekilde encode edilir", function () {
  var link = arizaWhatsappLink({ baslik: "%100 arıza & gecikme", oda: "B-2" });
  assert.ok(link.indexOf("%") >= 0);
  assert.equal(decodeURIComponent(link.slice("https://wa.me/?text=".length)).indexOf("%100 arıza & gecikme") >= 0, true);
});
