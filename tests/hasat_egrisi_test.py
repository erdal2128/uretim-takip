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
