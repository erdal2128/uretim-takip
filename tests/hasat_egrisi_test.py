# -*- coding: utf-8 -*-
"""
hasat_egrisi.py için bağımsız test (tkinter gerektirmez).
Çalıştır: python3 tests/hasat_egrisi_test.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import hasat_egrisi as he


def yorum_var(sonuc, parca):
    return any(parca.lower() in y.lower() for y in sonuc["yorumlar"])


def test_ideal_egri_yuksek_puan():
    r = he.hasat_egrisi_analiz([5.5, 20, 35, 30, 13])
    assert r is not None
    assert r["puan"] >= 90, r["puan"]
    assert r["etiket"] in ("Mükemmel", "Çok iyi")


def test_simetrik_can_egrisi():
    r = he.hasat_egrisi_analiz([10, 20, 40, 20, 10])
    assert r["puan"] >= 90, r["puan"]
    assert r["sekil"] == "simetrik", r["sekil"]


def test_on_yuklu_erken_cezasi():
    r = he.hasat_egrisi_analiz([40, 30, 15, 10, 5])
    assert r["sekil"] == "sol-carpik", r["sekil"]
    assert yorum_var(r, "erken"), r["yorumlar"]
    assert r["puan"] <= 90, r["puan"]


def test_tek_gune_yigilma():
    r = he.hasat_egrisi_analiz([5, 5, 80, 5, 5])
    assert r["sekil"] == "tek-gun", r["sekil"]
    assert yorum_var(r, "yığıl"), r["yorumlar"]
    assert r["puan"] < 70, r["puan"]


def test_gecikmis_hasat():
    r = he.hasat_egrisi_analiz([5, 10, 60, 15, 10])
    assert yorum_var(r, "gecik") or yorum_var(r, "geç"), r["yorumlar"]
    assert r["puan"] < 75, r["puan"]


def test_yayvan_dagilim():
    r = he.hasat_egrisi_analiz([20, 20, 20, 20, 20])
    assert r["sekil"] == "yayvan", r["sekil"]
    assert yorum_var(r, "yayvan"), r["yorumlar"]


def test_yetersiz_veri_none():
    assert he.hasat_egrisi_analiz([]) is None
    assert he.hasat_egrisi_analiz([50]) is None
    assert he.hasat_egrisi_analiz([0, 0, 0]) is None


def test_degisken_gun_sayisi():
    # 3 günlük bir flaş da değerlendirilebilmeli
    r = he.hasat_egrisi_analiz([20, 50, 30])
    assert r is not None and r["gun_sayisi"] == 3


def test_resample_ref_toplam_100():
    for n in (2, 3, 5, 6, 8):
        s = sum(he.resample_ref(n))
        assert abs(s - 100.0) < 0.01, (n, s)


def test_ogrenilmis_referans_yeterli_ornek():
    # 4 benzer flaş → öğrenilmiş referans döner, toplam ~100, 5 gün
    ornekler = [[5, 20, 35, 30, 13], [6, 18, 34, 29, 14], [4, 22, 36, 28, 12], [5, 21, 35, 30, 13]]
    ref, n = he.ogrenilmis_referans(ornekler, 5)
    assert ref is not None and n == 4
    assert abs(sum(ref) - 100.0) < 0.01
    assert len(ref) == 5


def test_ogrenilmis_referans_yetersiz_none():
    ref, n = he.ogrenilmis_referans([[5, 20, 35, 30, 13], [6, 18, 34, 29, 14]], 5)  # 2 < 3
    assert ref is None and n == 2


def test_ogrenilmis_referans_farkli_gun_sayisi_hizalanir():
    # 3 gün + 5 gün + 4 gün örnekler ortak n=5'e hizalanmalı
    ref, n = he.ogrenilmis_referans([[10, 60, 30], [5, 20, 35, 30, 10], [10, 40, 35, 15]], 5)
    assert ref is not None and n == 3 and len(ref) == 5
    assert abs(sum(ref) - 100.0) < 0.01


def test_ogrenilmis_referans_puanlamada_kullanilir():
    # Öğrenilmiş referans, analize verildiğinde ceza eşiği ona göre işler
    ref, _ = he.ogrenilmis_referans([[40, 30, 15, 10, 5]] * 3, 5)  # ön-yüklü "normal" firma
    r = he.hasat_egrisi_analiz([40, 30, 15, 10, 5], ref_yuzde=ref)
    # firma normali ön-yüklüyse, ön-yüklü bir eğri artık "erken" cezası almamalı
    assert not any("erken" in y.lower() for y in r["yorumlar"]), r["yorumlar"]
    assert r["puan"] >= 90, r["puan"]


def test_egri_uyum_birebir_100():
    ref = he.resample_ref(5)
    kasa = [r * 3 for r in ref]  # aynı dağılım (ölçek fark etmez)
    assert abs(he.egri_uyum(kasa, ref) - 100.0) < 0.01


def test_egri_uyum_uzak_dusuk():
    ref = [5, 20, 35, 30, 10]        # orta-zirveli
    kasa = [80, 5, 5, 5, 5]          # ön-yüklü, çok farklı
    u = he.egri_uyum(kasa, ref)
    assert u is not None and u < 60, u


def test_egri_uyum_yakin_uzaktan_yuksek():
    # Referansa yakın eğri, uzaktakinden DAHA yüksek uyum almalı (asıl istenen)
    ref = [5, 20, 35, 30, 10]
    yakin = he.egri_uyum([6, 22, 33, 29, 10], ref)
    uzak = he.egri_uyum([30, 30, 20, 10, 10], ref)
    assert yakin > uzak, (yakin, uzak)


def test_verim_puani_basamaklar():
    assert he.verim_puani(19) == (0, False)
    assert he.verim_puani(20) == (10, False)
    assert he.verim_puani(22.9) == (10, False)
    assert he.verim_puani(23) == (20, False)
    assert he.verim_puani(25) == (20, False)
    assert he.verim_puani(26) == (30, False)
    assert he.verim_puani(27.9) == (30, False)
    assert he.verim_puani(28) == (40, False)
    assert he.verim_puani(32) == (40, False)      # 32'nin ÜSTÜ yıldız
    assert he.verim_puani(32.1) == (40, True)
    assert he.verim_puani(None) == (0, False)


def test_ikinci_puani():
    assert he.ikinci_puani(0.0) == 10
    assert he.ikinci_puani(0.009) == 10
    assert he.ikinci_puani(0.01) == 0
    assert he.ikinci_puani(0.05) == 0
    assert he.ikinci_puani(None) == 0


def test_flas_puan_bilesim():
    ref = he.resample_ref(5)
    kasa = [r * 2 for r in ref]  # uyum ~100 → eğri 50
    r = he.flas_puan(kasa, ref, verim=29, ikinci_orani=0.0)
    assert r["egri_puan"] == 50.0
    assert r["verim_puan"] == 40
    assert r["ikinci_puan"] == 10
    assert r["toplam"] == 100
    assert r["yildizli"] is False
    # düşük verim + yüksek ikinci + uzak eğri
    r2 = he.flas_puan([80, 5, 5, 5, 5], ref, verim=18, ikinci_orani=0.2)
    assert r2["verim_puan"] == 0 and r2["ikinci_puan"] == 0
    assert r2["toplam"] < 40


def test_etiket_bantlari():
    assert he.etiket(100) == "Mükemmel"
    assert he.etiket(95) == "Çok iyi"
    assert he.etiket(85) == "İyi"
    assert he.etiket(72) == "Orta"
    assert he.etiket(61) == "Zayıf"
    assert he.etiket(40) == "Sorunlu"


def main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    gecti = 0
    for t in tests:
        try:
            t()
            print("ok   -", t.__name__)
            gecti += 1
        except AssertionError as e:
            print("FAIL -", t.__name__, "->", e)
        except Exception as e:
            print("ERR  -", t.__name__, "->", repr(e))
    print("\n%d/%d test geçti" % (gecti, len(tests)))
    sys.exit(0 if gecti == len(tests) else 1)


if __name__ == "__main__":
    main()
