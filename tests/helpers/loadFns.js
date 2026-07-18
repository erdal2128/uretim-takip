// index.html tek dosyalık bir vanilla JS uygulaması (build sistemi / modül yok).
// Bu yardımcı, uygulama dosyasını DEĞİŞTİRMEDEN, test edilecek saf fonksiyonların
// kaynak kodunu index.html'den ayıklayıp izole bir vm context'inde çalıştırır.
// Böylece testler DOM/Firebase/localStorage başlatmadan gerçek uygulama kodunu sınar.
"use strict";
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var INDEX_HTML = path.join(__dirname, "..", "..", "index.html");
var SRC = fs.readFileSync(INDEX_HTML, "utf8");

// "function ad(...) { ... }" gövdesini parantez dengesine göre bulur.
function extractFunctionSource(name) {
  var re = new RegExp("function\\s+" + name + "\\s*\\(");
  var m = re.exec(SRC);
  if (!m) throw new Error("Fonksiyon bulunamadı: " + name);
  var start = m.index;
  var braceOpen = SRC.indexOf("{", m.index);
  if (braceOpen === -1) throw new Error("Süslü parantez bulunamadı: " + name);
  var depth = 0;
  var i = braceOpen;
  for (; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}") {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return SRC.slice(start, i);
}

// Verilen fonksiyon adlarını mevcut (Node) realm'inde tanımlar — vm.createContext
// KULLANILMAZ, çünkü ayrı bir context'te oluşturulan diziler/objeler farklı bir
// realm'e ait olur ve assert.deepStrictEqual (Object prototype karşılaştırması
// yapar) testlerde yanlışlıkla başarısız olur. runInThisContext ile fonksiyonlar
// global'e tanımlanır ve referansları alınır (node:test her dosyayı ayrı
// process'te çalıştırdığı için bu, test dosyaları arasında sızıntı yapmaz).
// shimSrc (opsiyonel): loadData()/getSet() gibi global duruma (memData,
// localStorage) bağımlı fonksiyonları test edilebilir kılmak için, gerçek
// fonksiyonlardan ÖNCE çalıştırılan küçük bir yerine-koyma kaynağı — örn.
// "function loadData(){ return global.__TEST_DATA; }". Uygulama fonksiyonları
// index.html'den DEĞİŞTİRİLMEDEN alınır, sadece dışa bağımlılığı test ortamına
// bağlanır.
function loadFns(names, shimSrc) {
  var src = (shimSrc ? shimSrc + "\n" : "") + names.map(extractFunctionSource).join("\n");
  var script = new vm.Script(src, { filename: names.join(",") + ".js" });
  script.runInThisContext();
  var out = {};
  names.forEach(function (name) {
    out[name] = global[name];
  });
  return out;
}

module.exports = { loadFns: loadFns, extractFunctionSource: extractFunctionSource };
