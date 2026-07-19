# uretim-takip

Tek dosyalık (index.html) üretim takip uygulaması — vanilla JS (ES5), Firebase Firestore senkronu, PWA (sw.js).

## Kurallar

- **Versiyon:** `index.html` içindeki `var APP_VER = "vNNN";` her anlamlı değişiklikte bir artırılır (kullanıcı isteği). Küçük bir düzeltme bile yapılsa versiyon numarası yükseltilir.
- **Odalar sekmesi (liste/tablo görünümü) sade kalmalı:** Bottom nav'daki "Odalar" ekranındaki tabloda (özellikle "Bugün işlem" / "Yarın işlem" kolonları) SADECE sulama, CO₂ ve protokol işlemleri görünsün (kullanıcı isteği, bkz. PR #22). Mühendis değerlendirmesi, kritik olay notu veya başka herhangi bir yeni bilgi türü kullanıcı açıkça istemeden bu ekrana/tabloya EKLENMEMELİ — detaylı/zengin bilgiler Raporlar → Oda Analizi gibi ayrı ekranlarda gösterilmeli.
