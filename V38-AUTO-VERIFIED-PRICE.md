# StockPilot v38 — Auto + Verified Price Monitor

## Düzəlişlər
- AI Alış səhifəsi açılan kimi 6 saatdan köhnə və ya heç yoxlanmamış aktiv məhsullar avtomatik yoxlanır.
- Cloudflare cron yenə periodik işləyir; manual düymə yalnız əlavə refresh üçündür.
- Search snippet və səhifədəki təsadüfi rəqəmlər artıq qiymət kimi qəbul edilmir.
- Qiymət əsasən JSON-LD Offer, product price meta və Amazon main price elementindən təsdiqlənir.
- Məhsul adı və çəki/variant uyğunluğu yoxlanılır. Uyğun olmayan səhifə nəticədən çıxarılır.
- Mənbə prioriteti: brand official store, iHerb, Amazon, Walmart, Vitacost, Bodybuilding, GNC, Trendyol/Hepsiburada.
- Ən yaxşı qiymət etibarlı mənbələr arasından seçilir; şübhəli ucuz rəqəmlər ən yaxşı təklif ola bilmir.
- Təkliflərdə "Təsdiqlənmiş qiymət" etiketi göstərilir.

## Qeyd
Retail saytları bot oxumasını və regional qiymətləri dəyişə bilər. Sistem məhsul səhifəsində təsdiq edə bilmədiyi qiyməti göstərmir.
