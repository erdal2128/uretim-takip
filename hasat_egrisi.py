# -*- coding: utf-8 -*-
"""
hasat_egrisi.py — Hasat eğrisi (flaş dağılımı) kalite analizi.

Bir flaşın gün-gün kasa dağılımını yüzdeye çevirip ideal bir referans eğriye
(gün-3 zirveli çan) kıyaslayarak 0-100 kalite puanı ve okunaklı yorumlar üretir.
Web uygulamasındaki (index.html) hasatEgrisiAnaliz mantığının Python portudur.

Saf Python — hiçbir dış bağımlılık YOK (tkinter dahil). Böylece hem GUI'den
(hasat_takip_v73.py) çağrılabilir hem de bağımsız test edilebilir. GUI tarafı
bu modülü try/except ile import eder; modül klasörde yoksa hasat eğrisi özelliği
sessizce devre dışı kalır, program normal çalışmaya devam eder.

Ölçü, TOPLAM verimden bağımsızdır: az kasa toplanan bir flaş bile gün dağılımı
sağlıklıysa yüksek puan alabilir. Amaç, zamanlama/denge kalitesini ölçmektir.
"""

# İdeal 5 günlük yüzde eğrisi (gün-3 zirveli çan). Kaynak: web varsayılanı
# HASAT_EGRI_REFERANS min/max orta noktaları [~5.5, 20, 35, 30, 13].
HASAT_EGRI_REF_5 = [5.5, 20.0, 35.0, 30.0, 13.0]


def _resample_list(values, n):
    """Herhangi uzunluktaki bir listeyi n noktaya doğrusal interpolasyonla
    yeniden örnekler (değerleri normalize ETMEZ)."""
    m = len(values)
    if n <= 1:
        return [sum(values)] if values else [0.0]
    if m == 0:
        return [0.0] * n
    if m == 1:
        return [float(values[0])] * n
    out = []
    for i in range(n):
        pos = (i / (n - 1)) * (m - 1)   # 0..(m-1)
        lo = int(pos)
        hi = min(lo + 1, m - 1)
        frac = pos - lo
        out.append(values[lo] * (1 - frac) + values[hi] * frac)
    return out


def _normalize100(values):
    s = sum(values) or 1.0
    return [v / s * 100.0 for v in values]


def resample_ref(n):
    """5 noktalı ideal eğriyi n güne yeniden örnekler, toplamı 100'e normalize eder.
    n çoğu flaşta 5'tir; F2 daha kısa/uzun olabilir diye genelleştirilmiştir."""
    if n <= 1:
        return [100.0]
    return _normalize100(_resample_list(HASAT_EGRI_REF_5, n))


def ogrenilmis_referans(ornekler, n, min_ornek=3):
    """Geçmiş flaşlardan öğrenilmiş referans eğri. `ornekler` = flaşların kasa
    listeleri (her biri o flaşın gün-gün kasası). Her örnek yüzdeye çevrilip n
    güne yeniden örneklenir, ortalaması alınır (toplam 100).

    Döner: (ref_yuzde | None, kullanilan_ornek_sayisi). Örnek sayısı min_ornek'in
    altındaysa None döner → çağıran tarafın sabit ideale (resample_ref) düşmesi
    beklenir. Web'deki 'öğrenilen referans' kaskadının (oda→firma→genel) çekirdeği."""
    egriler = []
    for kasa in (ornekler or []):
        k = [float(x or 0) for x in (kasa or [])]
        if len(k) < 2 or sum(k) <= 0:
            continue
        egriler.append(_resample_list(_normalize100(k), n))
    if len(egriler) < max(1, min_ornek):
        return None, len(egriler)
    ort = [sum(e[i] for e in egriler) / len(egriler) for i in range(n)]
    return _normalize100(ort), len(egriler)


def egri_uyum(gunluk_kasa, ref_yuzde):
    """Bir flaşın gerçek gün dağılımı ile referans eğri arasındaki YAKINLIK
    yüzdesi (0-100). 100 = birebir aynı, 0 = tamamen farklı. Ölçü: toplam
    değişim uzaklığı (TVD) = 0.5 × Σ|gerçek% − referans%|; uyum = 100 − TVD.
    Kullanıcı isteği: 'tesise göre grafiğe ne kadar yakınsa o kadar iyi'.
    Referans farklı gün sayısındaysa gerçek eğrinin gün sayısına örneklenir.
    Değerlendirilemiyorsa (veri yok / referans yok) None döner."""
    k = [float(x or 0) for x in (gunluk_kasa or [])]
    if len(k) < 2 or sum(k) <= 0 or not ref_yuzde:
        return None
    a = _normalize100(k)
    r = _normalize100(_resample_list(list(ref_yuzde), len(a)))
    tvd = 0.5 * sum(abs(a[i] - r[i]) for i in range(len(a)))
    return max(0.0, 100.0 - tvd)


# Verim (kg/ton yüzdesi) puan basamakları — kullanıcı isteği.
VERIM_BASAMAK = [(20, 0), (23, 10), (26, 20), (28, 30)]  # üst sınır (hariç), puan
VERIM_YILDIZ = 32  # bu değerin ÜSTÜ yıldızlı 40 puan


def verim_puani(verim):
    """Verim yüzdesine göre (40 üzerinden) puan + yıldız bayrağı.
    <20→0 · 20-23→10 · 23-26→20 · 26-28→30 · 28+→40 · 32+→⭐40.
    verim None (tonaj girilmemiş) ise (0, False)."""
    if verim is None:
        return 0, False
    v = float(verim)
    for ust, puan in VERIM_BASAMAK:
        if v < ust:
            return puan, False
    return 40, (v > VERIM_YILDIZ)


def ikinci_puani(ikinci_orani):
    """İkinci kalite oranı %1'in altındaysa +10, değilse 0 (kullanıcı isteği:
    'ikinci oranı %1'den çok azsa 10 puan'). ikinci_orani None ise 0."""
    if ikinci_orani is None:
        return 0
    return 10 if ikinci_orani < 0.01 else 0


def flas_puan(gunluk_kasa, ref_yuzde, verim, ikinci_orani):
    """Bir flaşın 100 üzerinden bileşik puanı (kullanıcı isteği):
      • Eğri uyumu (tesis referansına yakınlık)  → 50
      • Verim basamağı                            → 40
      • İkinci oranı < %1                          → 10
    Döner: {toplam, yildizli, uyum, egri_puan, verim_puan, ikinci_puan}."""
    uyum = egri_uyum(gunluk_kasa, ref_yuzde)          # 0-100 | None
    egri = round((uyum or 0.0) / 100.0 * 50.0, 1)
    vp, yildiz = verim_puani(verim)
    ip = ikinci_puani(ikinci_orani)
    return {
        "toplam": int(round(egri + vp + ip)),
        "yildizli": yildiz,
        "uyum": uyum,
        "egri_puan": egri,
        "verim_puan": vp,
        "ikinci_puan": ip,
    }


def etiket(puan):
    """Puanı okunaklı banda çevirir (web hasatEgriPuanEtiket ile aynı eşikler)."""
    if puan >= 100:
        return "Mükemmel"
    if puan >= 90:
        return "Çok iyi"
    if puan >= 80:
        return "İyi"
    if puan >= 70:
        return "Orta"
    if puan >= 60:
        return "Zayıf"
    return "Sorunlu"


def hasat_egrisi_analiz(gunluk_kasa, ref_yuzde=None):
    """Bir flaşın gün-sırasına dizili kasa listesini değerlendirir.

    gunluk_kasa : [kasa_gun1, kasa_gun2, ...]  (tarihe göre sıralı)
    ref_yuzde   : opsiyonel özel referans yüzde eğrisi; verilmezse ideal kullanılır.

    Döner: dict {puan, etiket, sekil, pik_gun, gun_sayisi, yuzde, ref_yuzde, yorumlar}
    veya değerlendirilemiyorsa (toplam<=0 ya da <2 gün) None.
    """
    kasa = [float(x or 0) for x in (gunluk_kasa or [])]
    n = len(kasa)
    toplam = sum(kasa)
    if n < 2 or toplam <= 0:
        return None

    yuzde = [k / toplam * 100.0 for k in kasa]
    ref = list(ref_yuzde) if ref_yuzde is not None else resample_ref(n)

    # Erken / geç pencere gün sayısı (n=5 -> 2; küçük/büyük flaşta orantılı, orta
    # bölge en az 1 gün kalacak şekilde sınırlanır).
    e = max(1, round(n * 0.4))
    if n >= 4:
        e = min(e, (n - 1) // 2)

    erken = sum(yuzde[:e])
    gec = sum(yuzde[n - e:])
    orta = sum(yuzde[e:n - e]) if (n - e) > e else 0.0
    erken_bek = sum(ref[:e])
    gec_bek = sum(ref[n - e:])
    orta_bek = sum(ref[e:n - e]) if (n - e) > e else 0.0

    pik_idx = max(range(n), key=lambda i: yuzde[i])
    pik_gun = pik_idx + 1
    max_y = yuzde[pik_idx]

    puan = 100.0
    yorumlar = []

    # Erken hasat: ilk günler beklenenden belirgin yüksek → küçük toplanmış olabilir.
    if erken > erken_bek + 15:
        puan -= 15
        yorumlar.append("Erken hasat: ilk günlerde beklenenden fazla toplanmış — mantarlar küçük toplanmış olabilir.")

    # Gecikmiş hasat: orta güne aşırı yığılma + son günler zayıf.
    if orta > orta_bek + 15 and gec < gec_bek - 15:
        puan -= 15
        yorumlar.append("Gecikmiş hasat: orta güne yığılıp son günler zayıf kalmış — hasat geç kalmış olabilir.")

    # Kırılma: komşu günler arası >20 puanlık ani sıçrama/düşüş.
    kirilma = sum(1 for i in range(1, n) if abs(yuzde[i] - yuzde[i - 1]) > 20)
    if kirilma:
        puan -= min(20, kirilma * 8)
        yorumlar.append("Gün-gün ani sıçrama/düşüş (%d kırılma) — hasat planı, işgücü veya iklim kaynaklı olabilir." % kirilma)

    # Zirve keskinliği.
    sekil = None
    if max_y > 60:
        puan -= 10
        yorumlar.append("Tek güne aşırı yığılma (zirve %%%d) — dağılım çok dengesiz." % round(max_y))
        sekil = "tek-gun"
    elif max_y > 45:
        puan -= 5
        yorumlar.append("Keskin dar zirve (%%%d) — hasat çok kısa bir aralığa sıkışmış." % round(max_y))

    # Şekil sınıflandırması (tek-gün dışındakiler için).
    if sekil is None:
        if max_y < 22:
            sekil = "yayvan"
            yorumlar.append("Yayvan dağılım — belirgin bir zirve yok.")
        elif abs(erken - gec) <= 15 and 1 < pik_gun < n:
            sekil = "simetrik"
        elif erken > gec + 15:
            sekil = "sol-carpik"
        elif gec > erken + 15:
            sekil = "sag-carpik"
        else:
            sekil = "duzensiz"

    if not yorumlar:
        yorumlar.append("Dengeli, sağlıklı bir hasat eğrisi.")

    puan = max(0, int(round(puan)))
    return {
        "puan": puan,
        "etiket": etiket(puan),
        "sekil": sekil,
        "pik_gun": pik_gun,
        "gun_sayisi": n,
        "yuzde": yuzde,
        "ref_yuzde": ref,
        "yorumlar": yorumlar,
    }
