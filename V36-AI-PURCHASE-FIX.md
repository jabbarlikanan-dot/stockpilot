# StockPilot v36 — AI Alış düzəlişi

## Real bug fix
`ensureAiPurchaseSchema()` əvvəl cədvəlləri və indeksləri `Promise.all()` ilə eyni anda yaradırdı. D1 indeks sorğusunu cədvəldən əvvəl icra etdikdə `/api/ai-purchases` 500 verə bilirdi. Migration indi ardıcıl işləyir: əvvəl cədvəllər, sonra indekslər.

## Axtarış
- Tək DuckDuckGo query əvəzinə bir neçə query variantı yaradılır.
- DuckDuckGo + Bing HTML nəticələri birləşdirilir.
- iHerb, Amazon, Walmart və Trendyol üçün domain-scoped query-lər də sınanır.
- URL-lər deduplicate olunur.
- Daha çox uyğun məhsul səhifəsi yoxlanılır.
- Qiymət tapılmırsa rəqəm uydurulmur.

## UI
AI Alış səhifəsi ayrıca yenidən dizayn edildi:
- StockPilot-un UI font sistemi məcburi fallback ilə tətbiq olunur.
- Başlıq və summary daha kompakt oldu.
- Kartlar daha aydın hierarchy ilə quruldu.
- Status/error state ayrıca panel kimi görünür.
- Mobil 320–430px üçün ayrıca grid qaydaları var.
- Horizontal overflow qarşısı alındı.
