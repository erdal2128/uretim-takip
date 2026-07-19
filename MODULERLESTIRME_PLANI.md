# index.html Modülerleştirme ve Güvenli Refactoring Planı

## PROJENİN ANA KURALI

Bu çalışma bir özellik geliştirme çalışması değildir.

Bu çalışmanın amacı, yaklaşık 15.500 satırlık `index.html` dosyasını, uygulamanın mevcut davranışını değiştirmeden, build sistemi kullanmadan ve mevcut çalışma mimarisini bozmadan mantıksal JavaScript ve CSS dosyalarına ayırmaktır.

## TEMEL PRENSİP

**Davranış değişikliği yok. Mimari düzenleme var.**

Refactoring sırasında:

- Yeni özellik ekleme.
- Mevcut özellikleri kaldırma.
- Fonksiyonların davranışını değiştirme.
- Hesaplama mantığını değiştirme.
- Tarih hesaplama mantığını değiştirme.
- Üretim protokolünü değiştirme.
- Oda durumlarını değiştirme.
- Hasat hesaplarını değiştirme.
- İlaç uygulama tarihlerini değiştirme.
- Sulama hesaplarını değiştirme.
- localStorage anahtarlarını değiştirme.
- IndexedDB veri yapısını değiştirme.
- Firebase veri yapısını değiştirme.
- Firebase senkronizasyon mantığını değiştirme.
- Kullanıcı rollerini değiştirme.
- Mevcut global fonksiyon isimlerini değiştirme.
- Mevcut global değişken isimlerini değiştirme.

Yalnızca kodun fiziksel organizasyonu değiştirilecektir.

⸻

## 1. MEVCUT MİMARİ

Uygulama şu anda büyük ölçüde tek dosyalıdır: `index.html`.

Yaklaşık:

- 15.577 satır
- ~15.389 satır inline JavaScript (tek `<script>` bloğu)
- 967 top-level fonksiyon/değişken (817 fonksiyon + 150 değişken — AST tabanlı analizle doğrulandı)
- `memData`, `loadData()`, `saveData()`, `el()`, `render()` gibi merkezi yapıların yüzlerce farklı noktadan çağrılması söz konusu.

Uygulama bilinçli olarak build sistemi kullanmamaktadır.

Bu nedenle:

- ES Module kullanılmayacak.
- `type="module"` kullanılmayacak.
- Bundler kullanılmayacak.
- Webpack/Vite/Rollup vb. eklenmeyecek.
- npm build pipeline oluşturulmayacak.

Dosyalar normal `<script src="">` ile yüklenecek ve aynı browser global scope içinde çalışacaktır.

⸻

## 2. HEDEF MİMARİ

```
/
├── index.html
├── sw.js
├── CLAUDE.md
│
├── css/
│   └── app.css
│
├── js/
│   ├── 00-core.js
│   ├── 05-config.js
│   ├── 10-sync.js
│   ├── 20-protokol.js
│   ├── 30-degerlendirme.js
│   ├── 40-roller.js
│   ├── 50-ekranlar.js
│   ├── 60-kurallar.js
│   └── 99-boot.js
│
└── tests/
    └── helpers/
        └── loadFns.js
```

İlk refactoring aşamasında `50-ekranlar.js` tek dosya olarak kalacaktır. Bu dosya başlangıçta büyük olabilir. Bu bilinçli bir tercihtir.

İlk hedef: **Güvenli modülerleştirme.**
İkinci hedef: **Gerektiğinde daha küçük özellik dosyalarına ayrıştırma.**

⸻

## 3. DOSYA SORUMLULUKLARI

### `00-core.js`
Merkezi uygulama altyapısı: `memData`, `loadData()`, `saveData()`, `el()`, IndexedDB, localStorage, global sabitler, temel yardımcı fonksiyonlar. Bu dosya mümkün olduğunca stabil tutulmalıdır.

### `05-config.js`
Uygulama konfigürasyonu: uygulama sürümü (`APP_VER`), Firebase konfigürasyonu, Service Worker cache versiyonu, merkezi sabitler. `00-core.js` ile karıştırılmamalıdır.

### `10-sync.js`
Firebase, senkronizasyon, bulut yedekleme, yedekleme işlemleri, veri geri yükleme, senkronizasyon yardımcıları. Protokol hesaplamaları veya ekran render kodları burada bulunmamalıdır.

### `20-protokol.js`
Üretim protokolü: kompost geliş tarihi, kompost günü, tiftik, toprak serimi, tırmık, hava, flaş, sulama, ilaç uygulama tarihleri, protokol adımları, SSOT mantığı.

**KRİTİK KURAL**: Bir tarih hesabının mevcut kodda hangi başlangıç tarihinden üretildiği kesin olarak korunmalıdır.

```
Kompost tarihi → Kompost günü → Toprak serimi → Tırmık → Hava → Flaş → Hasat
```

Bu zincirde herhangi bir başlangıç tarihinin değiştirilmesi refactoring değildir ve yasaktır.

### `30-degerlendirme.js`
Mühendis değerlendirme sistemi, kompost değerlendirmesi, hasat eğrisi, firma performansı, firma karne sistemi, üretim performans analizleri. Mevcut puanlama/değerlendirme mantığı değiştirilmeyecektir.

### `40-roller.js`
Personel, yoklama, roller, yetki kontrolü, audit, login, uygulama açılışında rol yükleme.

### `50-ekranlar.js`
İlk aşamada tüm ekran render fonksiyonları burada kalacaktır: `render()`, Bugün, Tur, Odalar, Raporlar, Ayarlar, Hasat, Üretim ekranları, diğer mevcut render fonksiyonları. UI ve iş mantığının iç içe olduğu bölümler ilk aşamada zorla ayrıştırılmayacaktır. Amaç yalnızca güvenli fiziksel taşıma yapmaktır.

### `60-kurallar.js`
Risk değerlendirmesi, kural tabanlı kontroller, ilaç/kimyasal kuralları, AI kontrolü, uyarılar. Mevcut kurallar değiştirilmeyecektir.

### `99-boot.js`
Uygulamanın başlatılması: Service Worker kaydı, `fbInit()`, `loadRole()`, `render()`, ilk açılış tetikleyicileri. Bu dosya en son yüklenmelidir.

⸻

## 4. SCRIPT YÜKLEME SIRASI

```html
<script src="js/00-core.js"></script>
<script src="js/05-config.js"></script>
<script src="js/10-sync.js"></script>
<script src="js/20-protokol.js"></script>
<script src="js/30-degerlendirme.js"></script>
<script src="js/40-roller.js"></script>
<script src="js/50-ekranlar.js"></script>
<script src="js/60-kurallar.js"></script>
<script src="js/99-boot.js"></script>
```

Sıra rastgele değiştirilmeyecektir. Normal `<script>` kullanımı korunacaktır. Bu sıra, top-level bağımlılık analiziyle doğrulanmıştır (bkz. Bölüm 6).

⸻

## 5. ENVANTER (FAZ 0'DA ÇIKARILDI)

`index.html` üzerinde acorn (AST) tabanlı statik analiz çalıştırıldı. Sonuç: **817 top-level fonksiyon + 150 top-level değişken = 967 öğe**.

Her öğe için: mevcut konum (satır aralığı), mevcut yorum-bölümü, önerilen hedef dosya çıkarıldı. Tam envanter tablosu ayrı bir CSV olarak üretildi (isim, tür, başlangıç/bitiş satırı, mevcut bölüm, hedef dosya).

### Hedef dosya başına öğe sayısı

| Hedef dosya | Öğe sayısı |
|---|---|
| `00-core.js` | 68 |
| `05-config.js` | 3 (`APP_VER`, `FIREBASE_CONFIG`, `FARM_CODE`) |
| `10-sync.js` | 78 |
| `20-protokol.js` | 108 |
| `30-degerlendirme.js` | 142 |
| `40-roller.js` | 72 |
| `50-ekranlar.js` | 410 |
| `60-kurallar.js` | 86 |
| **Toplam** | **967** |

### Mekanik yöntemin yetersiz kaldığı, elle düzeltilen öğeler

Satır-aralığı/yorum-başlığı yöntemi, fiziksel yakınlık yüzünden bazı GERÇEK ortak yardımcıları yanlış temaya düşürdü. Çapraz-referans analiziyle (bir global kaç farklı hedef dosyadan çağrılıyor) tespit edilip düzeltildi:

**`00-core.js`'e taşınmalı** (temaya değil, gerçek ortak yardımcı — 5-7 farklı hedef dosyadan çağrılıyor):
`esc`, `fmtDate`, `cmpDate`, `addDays`, `daysBetween`, `todayISO`, `numParse`, `parseISO`, `addMonths`

**`20-protokol.js`'e taşınmalı** (mekanik yöntem yanlışlıkla 30-degerlendirme.js/50-ekranlar.js çıkardı, ama içerik protokol/tarih zinciri):
`gunNo`, `ortuGun`, `gunEtiket` (kompost/üretim günü hesabı), `getSet` (protokol gün toleransı offsetleri), `BUILTIN_ROLLER`, `REF_ETIKET_TAM`, `REF_SECENEKLERI`, `TEKRAR_BITIS_ETIKET`, `refEtiketi`, `tekrarBitisEtiketi`, `tekrarBitisDropdownHTML`, `getOzelRoller`, `tumReferanslar`, `ozelRolEkle`, `ozelRolSil`, `refDropdownHTML`, `refSahipsizMi` (protokol referans-noktası kataloğu SSOT'si)

**ÖNEMLİ KISIT**: 967 öğenin tamamı tek tek elle doğrulanmadı — yalnızca "4+ farklı hedef dosyadan çağrılan" sinyaline göre şüpheli olanlar incelendi. Geri kalanı (özellikle `50-ekranlar.js`'in 410 öğesi) ilk-geçiş mekanik tahmindir; **her fonksiyon taşınmadan hemen önce içeriği gözle teyit edilmelidir** (bkz. FAZ 8).

⸻

## 6. TOP-LEVEL BAĞIMLILIK KONTROLÜ

Bir fonksiyonun gövdesi içinde başka bir global fonksiyonun çağrılması genellikle sorun değildir — çalışma zamanında (tüm scriptler yüklendikten sonra) tetiklenir, dosya sırasından bağımsızdır.

Ancak fonksiyon GÖVDESİ DIŞINDA (top-level) çalışan kodlar kritiktir. AST analizinde `index.html`'in tüm 15.389 satırlık script'inde **yalnızca 4 top-level çalışan (fonksiyon/var bildirimi olmayan) statement** bulundu:

1. `"use strict";` (satır 2) — ilk yüklenen dosyanın (`00-core.js`) ilk satırı olmalı.
2. `BUILTIN_ROLLER.forEach(function(r){ REF_ETIKET_TAM[r.v]=r.l; });` (satır 4423) — `BUILTIN_ROLLER` ve `REF_ETIKET_TAM` ile aynı dosyada (`20-protokol.js`), onlardan SONRA konumlanmalı.
3-4. Service Worker kaydı + `appBoot();` (satır 15383-15388) — `99-boot.js`, en son yüklenmeli.

Bunun dışında hiçbir top-level sıralama tehlikesi tespit edilmedi.

⸻

## 7. KRİTİK TARİH HESAPLAMA ZİNCİRİ

Tespit edilen ve hepsi `20-protokol.js` hedefinde tek çatı altında olması gereken fonksiyonlar:

- `protokolReferansTarihi` (satır 1775), `protokolTarih` (1840), `adimYapilmaTarihi` (2096) — SSOT bölümü (2006-2785)
- `gunNo`, `ortuGun`, `gunEtiket` (3459-3475) — kompost/üretim günü hesabı
- `beklenenTakvim` (4319) — protokol beklenen takvim (şimdilik `30-degerlendirme.js`'de, hasat eğrisi analiziyle iç içe — ayrı incelenmeli)
- `hasatFlasBaslangic`, `hasatAsama` (4057-4095) — `30-degerlendirme.js`
- `ilacGecmisi` (8558) — `60-kurallar.js`

### Regresyon referans değerleri (Playwright ile ölçüldü, sonraki fazlarda birebir aynı kalmalı)

```
Test cycle: gelis = bugünden 15 gün önce, toprak = gelis + 13
gunNo(c, bugün)                    = 15
protokolTarih(c, toprak_adımı)     = gelis + 13 (doğru tarih)
odaPerformans(c).puan              = 98
```

⸻

## 8. KRİTİK VERİ AKIŞLARI

`memData` (bellek) ↔ `loadData()`/`saveData()` (localStorage + IndexedDB) ↔ Firebase Firestore senkron (`handleSettingsSnapshot` vb.) ↔ `render()` merkezi dispatcher → `view.name`'e göre ~29 `renderXxx()` ekranı. Hepsi tek global scope'ta; `el()`, `saveData()`, `render()` yüzlerce yerden çağrılıyor. Bölme bunu bozmaz çünkü hepsi aynı scope'ta kalacaktır (ES Module YOK).

⸻

## 9. FAZ 0 BASELINE SONUÇLARI (ölçüldü, kayıt altına alındı)

- `node --check`: **SYNTAX OK**
- `npm test`: **69/69 geçti**
- Playwright smoke test: uygulama açılışı ✅, Bugün ekranı ✅, oda detay açma ✅, Üretim/Protokol sekmesi ✅, Hasat sekmesi ✅, konsol hatası yok (yalnızca beklenen route-block ağ hataları).
- Regresyon referans değerleri: bkz. Bölüm 7.

Her fazın sonunda bu baseline'a karşı karşılaştırma yapılacaktır.

⸻

## 10. RİSKLİ BÖLÜMLER

- **`50-ekranlar.js` (410 öğe, ~10.000 satır)**: UI/mantık iç içe, en büyük ve en riskli parça — bilinçli olarak FAZ 1'de bölünmeyecek, tek dosya olarak taşınacak.
- **Mekanik satır-aralığı yöntemi**: Bölüm 5'te kanıtlandığı gibi gerçek ortak yardımcıları yanlış dosyaya düşürebiliyor — her taşımadan önce elle teyit şart.
- **`sw.js`**: `CORE_ASSETS` şu an sadece `["./","./index.html"]`; yeni dosyalar eklenmeden offline mod kırılır. Cache versiyonu artırılmalı, offline test yapılmalı.
- **`tests/helpers/loadFns.js`**: `index.html`'i TEK metin olarak okuyor; çoklu dosyaya geçilince güncellenmesi zorunlu, aksi halde 69 test de kırılır. Güncelleme yaklaşımı: `index.html`'deki `<script src="...">` etiketlerini DOM sırasına göre bul, dosyaları sırayla oku ve birleştir, mevcut `extractFunctionSource()` mantığını bu birleşik metin üzerinde çalıştırmaya devam et — tek doğruluk kaynağı `index.html`'deki script sırası olur.
- **`CLAUDE.md`**: "Tek dosyalık (index.html)" ifadesi refactoring tamamlanınca yanlış olacak, ayrı bir commit'te güncellenmeli.

⸻

## 11. REFACTORING FAZLARI

### FAZ 0: BASELINE ✅ TAMAMLANDI
Git commit, `npm test`, `node --check`, Playwright smoke test (açılış, oda, üretim kaydı, Bugün, Protokol, Hasat ekranları) — bkz. Bölüm 9.

### FAZ 1: CSS
`<style>` bloğunu `css/app.css`'e taşı. `index.html`'e `<link rel="stylesheet" href="css/app.css">` ekle. CSS davranışı değiştirilmez. Test: `npm test`, `node --check`, browser smoke test.

### FAZ 2: CORE
`js/00-core.js`: state, storage, IndexedDB, yardımcılar. Fonksiyon içeriği değiştirilmeden taşınır.

### FAZ 3: CONFIG
`js/05-config.js`: konfigürasyonlar. Mevcut değerler değiştirilmez.

### FAZ 4: SYNC
`js/10-sync.js`: Firebase ve senkronizasyon kodları. Firebase veri formatı değiştirilmez.

### FAZ 5: PROTOKOL
`js/20-protokol.js`: üretim protokolü kodları. Tarih hesapları (Bölüm 7) önce/sonra karşılaştırılır — fark OLMAMALIDIR.

### FAZ 6: DEĞERLENDİRME
`js/30-degerlendirme.js`. Puanlama/analiz mantığı değiştirilmez.

### FAZ 7: ROLLER
`js/40-roller.js`. Login ve yetki davranışları değiştirilmez.

### FAZ 8: EKRANLAR
`js/50-ekranlar.js`: tüm render fonksiyonları. İlk aşamada bu dosya daha küçük parçalara bölünmez. Öncelik: çalışan kodu olduğu gibi taşımak. Her fonksiyon taşınmadan önce içerik gözle teyit edilir (Bölüm 5'teki kısıt nedeniyle).

### FAZ 9: KURALLAR
`js/60-kurallar.js`. Mevcut risk/ilaç kuralları değiştirilmez.

### FAZ 10: BOOT
`js/99-boot.js`: başlatma kodları. En son yüklenir, uygulama açılışı burada başlar.

⸻

## 12. HER FAZ SONRASI ZORUNLU TEST

1. `node --check`
2. `npm test`
3. Playwright smoke test
4. Uygulama açılış testi
5. LocalStorage test
6. IndexedDB test
7. Firebase test
8. En az bir oda görüntüleme
9. Bugün ekranı
10. Protokol ekranı
11. Tarih hesapları (Bölüm 7'deki referans değerlerle karşılaştırma)

Bir test başarısızsa sonraki faza geçilmez.

⸻

## 13. TARİH HESAPLAMA REGRESYON TESTLERİ

En azından şu senaryolar test edilmeli:

```
Kompost geliş tarihi   → Kompost günü
Toprak serimi tarihi   → Tırmık tarihi
Toprak serimi tarihi   → Hava tarihi
Toprak serimi tarihi   → Flaş başlangıcı
Flaş başlangıcı        → Hasat tarihi
```

Özellikle: kullanıcının manuel olarak tarih değiştirdiği durumda diğer tarihlerin doğru güncellenmesi test edilmeli. Ayrıca: bugünün tarihi ile hesaplanan üretim gününün birbirine karıştırılmadığı kontrol edilmeli.

⸻

## 14. VERİ BÜTÜNLÜĞÜ

Refactoring sonrası mevcut kayıtlar (eski odalar, üretim kayıtları, hasat kayıtları, personel kayıtları, protokoller, değerlendirmeler) açılabilmelidir. Migration gerekiyorsa migration ayrı bir işlem olarak ele alınır. **Refactoring sırasında veri migration yapılmayacaktır.**

⸻

## 15. SERVICE WORKER

`CORE_ASSETS` yeni dosyaları içerecek şekilde güncellenmelidir:

```js
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/00-core.js",
  "./js/05-config.js",
  "./js/10-sync.js",
  "./js/20-protokol.js",
  "./js/30-degerlendirme.js",
  "./js/40-roller.js",
  "./js/50-ekranlar.js",
  "./js/60-kurallar.js",
  "./js/99-boot.js"
];
```

`CACHE_NAME` artırılmalı, eski cache'lerin temizlenmesi kontrol edilmeli, offline test yapılmalı (ağ kesildiğinde index.html/CSS/JS/uygulama açılışı/mevcut kayıtların görüntülenmesi çalışmalı).

⸻

## 16. TESTLERİN GÜNCELLENMESİ

`tests/helpers/loadFns.js` artık yalnızca `index.html` içindeki inline JavaScript'i okumamalı. Bunun yerine:

1. `index.html` dosyasını oku.
2. `<script src="...">` etiketlerini sırayla bul.
3. Script dosyalarını DOM sırasına göre oku.
4. İçerikleri aynı sırayla birleştir.
5. Mevcut `extractFunctionSource()` mantığını bu birleşik metin üzerinde çalıştır.

Böylece test sisteminin doğruluk kaynağı `index.html` içindeki script sırası olur — ayrı bir dosya listesi bakımı gerekmez.

⸻

## 17. GERİ ALMA KURALI

Her faz ayrı Git commit olmalı:

```
refactor: extract CSS
refactor: extract core
refactor: extract config
refactor: extract sync
refactor: extract protocol
refactor: extract evaluation
refactor: extract roles
refactor: extract screens
refactor: extract rules
refactor: extract boot
```

Her faz bağımsız olarak geri alınabilmelidir. Bir fazın testi başarısız olursa: önceki çalışan commit'e geri dön. Çalışmayan kodun üzerine yeni değişiklik yaparak hatayı büyütme.

⸻

## 18. KESİNLİKLE YAPILMAYACAKLAR

- Yeni framework ekleme.
- TypeScript'e geçme.
- ES Module'a geçme.
- Build sistemi ekleme.
- Fonksiyonları yeniden yazma.
- Tarih hesaplarını "daha mantıklı" olduğu düşüncesiyle değiştirme.
- Veri modelini değiştirme.
- localStorage anahtarlarını değiştirme.
- Firebase yapısını değiştirme.
- CSS tasarımını değiştirme.
- UI tasarımını değiştirme.
- Yeni özellik ekleme.
- Eski kodu "temizlemek" amacıyla silme.

Bir kod parçası hatalı görünüyorsa: yerini not et, refactoring'i durdurma, ayrı bir bug listesine ekle, refactoring tamamlandıktan sonra ayrı commit'te düzelt.

⸻

## 19. REFACTORING SONRASI İKİNCİ AŞAMA

İlk refactoring tamamen tamamlandıktan ve tüm testler geçtikten sonra ayrı bir çalışma başlatılabilir. Bu aşamada `50-ekranlar.js`, `60-kurallar.js` ve diğer büyük dosyalar özellik bazında ayrıştırılabilir. Örneğin:

```
50-ekranlar.js
  ↓
51-ekran-bugun.js
52-ekran-odalar.js
53-ekran-tur.js
54-ekran-hasat.js
55-ekran-raporlar.js
56-ekran-ayarlar.js
```

Bu işlem ilk refactoring ile aynı anda yapılmayacaktır.

⸻

## 20. BAŞARI KRİTERİ

> "Kod artık birden fazla dosyada bulunuyor ancak kullanıcı açısından uygulama, refactoring öncesindeki uygulamanın birebir aynı davranışını gösteriyor."

Başarı kriteri dosya sayısı değildir. Başarı kriteri: uygulamanın açılması, verilerin korunması, tarihlerin doğru hesaplanması, üretim protokolünün aynı çalışması, oda durumlarının aynı çalışması, hasat hesaplarının aynı çalışması, Firebase senkronizasyonunun aynı çalışması, offline çalışmanın devam etmesi, testlerin başarılı olmasıdır.

⸻

## 21. UYGULAMA TALİMATI

Bu plan **tek seferde bütün kod üzerinde uygulanmayacaktır.** Her faz ayrı ayrı uygulanır. Her faz sonunda: yapılan değişiklikler özetlenir, taşınan fonksiyonlar listelenir, değişen dosyalar listelenir, test sonuçları bildirilir, başarısız test varsa nedeni belirtilir, sonraki faza geçmeden önce mevcut uygulamanın çalıştığı doğrulanır.

Kod taşırken bir fonksiyonun başka bir dosyaya bağımlılığı varsa, fonksiyon rastgele kopyalanmaz — önce bağımlılık analiz edilir. Global scope korunmalıdır. Fonksiyonun davranışı korunmalıdır. Dosya sınırı nedeniyle fonksiyon gövdesi değiştirilmemelidir.

**Durum**: FAZ 0 (Baseline + Envanter) tamamlandı (bkz. Bölüm 5, 9). Sonraki fazlar kullanıcı onayı olmadan başlatılmayacaktır.
