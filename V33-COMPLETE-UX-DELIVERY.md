# StockPilot v33 — Complete UX + Delivery

## Auth
- Login/register panelində sağ padding və field spacing balanslaşdırıldı.
- Extra-bold görünüş yumşaldılıb, əsas başlıqlar bold (700) edilib.
- Auth panel sağ tərəfə daha düzgün hizalanıb.
- Aktiv formun hündürlüyü dinamik ölçülür; login-də aşağıda artıq boş sahə qalmır.
- Mobil auth ayrıca kompakt layout alır.

## Bildiriş popover-i
- Bildirişlər yan-yana yox, kompakt vertikal list kimi görünür.
- Horizontal scroll aradan qaldırılıb.
- Unread bildirişlər lime dot ilə seçilir.
- `Oxundu et` bütün unread bildirişləri popover-dən təmizləyir, amma `Hamısına bax` səhifəsində tarixçə qalır.
- Mobil ekranda popover bottom-sheet kimi davranır.

## Mağaza
- Stok sayları müştəriyə göstərilmir və stok 0 olsa belə sifariş qəbul edilir.
- Məhsul kartları genişləndirilib; qiymət və ₼ eyni sətirdə qalır.
- Məhsul adı ilə axtarış, kateqoriya və sıralama saxlanılıb; stok filtri çıxarılıb.
- Store header tam enli və responsive edilib.

## Taksi ilə ünvana çatdırılma
- Checkout-da `Taksi ilə ünvana` seçimi var.
- Müştəri Leaflet/OpenStreetMap xəritəsində nöqtə seçə və ya cari konumunu götürə bilir.
- Checkout address mode-da daha geniş panelə çevrilir.
- Mağaza çıxış nöqtəsi → müştəri konumu yol məsafəsi serverdə OSRM ilə hesablanır; servis əlçatan deyilsə məsafə fallback modeli istifadə olunur.
- Çatdırılma qiyməti öz tarif modelinə əsaslanır: baza + km, minimum qiymət, səhər/axşam pik, gecə və həftəsonu əmsalları.
- Qiymət seçilən çatdırılma saatına görə dərhal yenilənir.
- Sifariş göndəriləndə server qiyməti yenidən hesablayıb sifarişdə sabitləyir.
- Checkout xülasəsi: Məhsullar / Çatdırılma / Yekun.

## Admin çatdırılma ayarları
Profil səhifəsinə əlavə olunub:
- mağaza çıxış nöqtəsi (lat/lng + ad),
- cari konumu götür,
- baza qiymət,
- km qiyməti,
- minimum qiymət,
- səhər pik, axşam pik, gecə və həftəsonu əmsalları.

## Tracking
- Status xətti artıq status mətnlərinin üstündən keçmir.
- Məhsul cəmi, çatdırılma haqqı və yekun ayrıca göstərilir.
- `Paylaş` native share istifadə edir; dəstəklənmirsə link kopyalanır.
- Ayrıca `Linki kopyala` düyməsi var.
- QR tracking əvvəlki kimi qalır.
