# StockPilot v31 — QR order tracking

## Yeniliklər
- Mağaza məhsul kartlarında **stokda neçə ədəd qaldığı artıq göstərilmir**.
- Məhsul mövcud deyilsə yalnız `Stokda yoxdur` statusu görünür.
- Sifariş tamamlandıqdan sonra **QR kod yaradılır**.
- QR kod `order-track.html?shop=...&id=...` izləmə səhifəsinə aparır.
- İzləmə səhifəsində:
  - sifariş statusu,
  - status timeline,
  - məhsul şəkli,
  - məhsul adı,
  - miqdar,
  - qiymət,
  - ümumi məbləğ,
  - çatdırılma vaxtı və üsulu göstərilir.
- Public tracking API şəxsi telefon, ünvan və müştəri adını qaytarmır.
- QR üçün xarici şəkil servisi (`api.qrserver.com`) istifadə olunur; izləmə linki ayrıca düymə kimi də mövcuddur.
