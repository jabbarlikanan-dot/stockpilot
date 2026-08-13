# StockPilot — şəxsi stok, sifariş və açıq mağaza sistemi

Bu paket **static upload üçün deyil**. Fərdi hesabların, şifrələrin, sifarişlərin və statistikanın telefonla digər kompüterdə də eyni qalması üçün Cloudflare Worker + D1 database ilə deploy edilməlidir.

## Quraşdırma

1. Cloudflare-də `stockpilot-db` adlı D1 database yaradın.
2. Worker Settings → Variables and Secrets hissəsində `AUTH_SECRET` yaradın. Uzun, təsadüfi bir mətn yazın (ən azı 32 simvol).
3. D1 Console-da `schema.sql` faylının bütün məzmununu yenidən işə salın. Bu, açıq mağaza sifarişləri üçün `customer_orders` cədvəlini yaradır.
4. Layihəni GitHub-a bu qovluğun içindəki bütün faylları birlikdə yükləyin və `npx wrangler deploy` ilə deploy edin.

Bu paket qovluqsuz quruluşdadır: HTML, CSS, JS, ikonlar və `worker.js` eyni qovluqdadır. `worker.js`, `schema.sql` və `wrangler.jsonc` silinməməlidir.
Profil şəkli indi aktiv deyil; qeydiyyatda şəkil seçmədən davam edin. Bu, əlavə ödənişli R2 yaddaşı tələb etməməsi üçündür.

## Nəticə

- Hər username ayrı profildir.
- Sifariş, məhsul, foto və statistika həmin userə məxsusdur.
- İstənilən cihazdan eyni username və 4 rəqəmli şifrə ilə giriş etmək olur.
- "Satıldı et" seçimi satış tarixini saxlayır; statistika gün/həftə/ay/il üzrə bu məlumatlardan hesablanır.
- Qeydiyyatdan keçən user avtomatik daxil olur və birbaşa dashboard-a yönləndirilir.
- Dashboard-dakı **Mağazam** düyməsi hər username üçün şəxsi açıq kataloqu açır. Müştəri sifarişi paneldə **Yeni müştəri sifarişləri** bölməsinə düşür.
- Müştəri sifarişi “Çatdırıldı” ediləndə stok avtomatik azalır.

## Yeni idarəetmə alətləri

- **Profil ayarları:** ad, soyad, username və 4 rəqəmli şifrəni dəyişmək mümkündür.
- **Stok nəzarəti:** qalan say, minimum stok həddi, az qalan məhsullar, favorilər və sürətli `+ / −` say dəyişimi.
- **Karqo kalkulyatoru:** Amerika, Türkiyə və İspaniya üçün şəxsi tariflərdən istifadə edən sürətli hesablama.
- **Sifariş arxivi:** bitmiş sifarişləri aktiv siyahıdan gizlədib sonradan geri qaytarmaq.
- **Məhsul idarəetməsi:** kateqoriya, qısa qeyd, axtarış, satılan/satılmayan filteri, silinən məhsulu geri qaytarma, Excel import/export.

Bu səhifələrin hamısı eyni `username`-in D1-dəki şəxsi məlumatlarını oxuyur; başqa user-lərin sifarişləri görünmür.
