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
- “Satıldı et” seçimi satış tarixini saxlayır; statistika gün/həftə/ay/il üzrə bu məlumatlardan hesablanır.

## Müştəri sifarişləri

- Mağaza linki: `store.html?shop=USERNAME`.
- Müştəri sifarişləri ayrıca **Müştəri sifarişləri** səhifəsində görünür; şəxsi alış-satış paneli daha yığcam qalır.
- Hər müştəri sifarişini statusa görə izləmək, redaktə etmək və tam silmək olar.
- `Tamamlandı` statusunda məhsul stokdan düşür, satış və qazanc şəxsi statistikaya yazılır; sifariş əsas siyahıdan çıxıb **Ümumi sifarişlər** tarixçəsində qalır.
- WhatsApp düyməsi şəxsi WhatsApp tətbiqində hazır status mətnini açır. Bu pulsuz kliklə-göndər variantıdır; avtomatik göndəriş üçün ayrıca WhatsApp Business API tələb olunur.
- Ayrı karqo kalkulyatoru yoxdur. Tarif və məzənnələr paneldə **Ayarlar** düyməsindən istənilən vaxt dəyişdirilir.
- Qeydiyyatdan keçən user avtomatik daxil olur və birbaşa dashboard-a yönləndirilir.
- Dashboard-dakı **Mağazam** düyməsi hər username üçün şəxsi açıq kataloqu açır. Müştəri sifarişi paneldə **Yeni müştəri sifarişləri** bölməsinə düşür.
- Müştəri sifarişi “Tamamlandı” ediləndə stok avtomatik azalır.

### Avtomatik WhatsApp status mesajı

Status dəyişəndə avtomatik WhatsApp mesajı göndərmək üçün Cloudflare Worker → **Settings → Variables and Secrets** bölməsində bunları əlavə edin:

- `WA_TOKEN` — Meta WhatsApp Cloud API access tokeni (**Secret** seçin).
- `WA_PHONE_NUMBER_ID` — WhatsApp Business göndərən nömrəsinin Phone Number ID-si.
- `WA_TEMPLATE_NAME` — Meta-da təsdiqlənmiş template adı.
- `WA_TEMPLATE_LANGUAGE` — template dil kodu, məsələn `az` və ya Meta-da seçdiyiniz kod.

Template body-sində iki dəyişən olmalıdır: `{{1}}` müştərinin adı, `{{2}}` sifariş statusu. Bu dəyişənlər əlavə edilməyibsə, sifarişin statusu yenə dəyişir, sadəcə avtomatik mesaj göndərilmir.

## Yeni idarəetmə alətləri

- **Profil ayarları:** ad, soyad, username və 4 rəqəmli şifrəni dəyişmək mümkündür.
- **Stok nəzarəti:** qalan say, minimum stok həddi, az qalan məhsullar, favorilər və sürətli `+ / −` say dəyişimi.
- **Tarif planları:** Amerika, Türkiyə və İspaniya üçün tarif və məzənnələr birbaşa Ayarlar bölməsindən dəyişdirilir.
- **Sifariş arxivi:** bitmiş sifarişləri aktiv siyahıdan gizlədib sonradan geri qaytarmaq.
- **Məhsul idarəetməsi:** kateqoriya, qısa qeyd, axtarış, satılan/satılmayan filteri, silinən məhsulu geri qaytarma, Excel import/export.

Bu səhifələrin hamısı eyni `username`-in D1-dəki şəxsi məlumatlarını oxuyur; başqa user-lərin sifarişləri görünmür.
