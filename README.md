# uretim-takip

## Testler

`index.html` build sistemi olmayan tek dosyalık bir uygulama. Testler bu dosyayı
DEĞİŞTİRMEDEN, saf (DOM'suz) fonksiyonların kaynağını `tests/helpers/loadFns.js`
ile ayıklayıp Node'un yerleşik test runner'ında çalıştırır.

```
npm test
```
