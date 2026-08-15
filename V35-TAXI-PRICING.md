# StockPilot v35 — Bakı taksi qiymət modeli

## Yeni default tarif
- Minimum çatdırılma: **5.00 ₼**
- Baza qiymət: **3.20 ₼**
- 1 km üçün: **0.32 ₼**
- Səhər pik: **×1.08**
- Axşam pik: **×1.12**
- Gecə: **×1.08**
- Həftəsonu: **×1.05**

Bu rəqəmlər real Bolt/Yango/Uber daxili formulası deyil. Məqsəd Bakı ride-hailing bazarında görünən qiymət səviyyələrinə yaxın, daha yumşaq estimate yaratmaqdır.

## Nümunələr (standart saat)
- 2 km → minimum səbəbindən **5.00 ₼**
- 5 km → **5.00 ₼**
- 10 km → **6.40 ₼**
- 20 km → **9.60 ₼**
- 25 km → **11.20 ₼**
- 50 km → **19.20 ₼**

## Ayarlar
Profil → Çatdırılma bölməsində bütün rəqəmlər dəyişdirilə bilər.
`Bakı taksi preset` düyməsi default balanslı modeli bir kliklə doldurur.
Server minimum qiyməti hər halda 5 ₼-dan aşağı buraxmır.
