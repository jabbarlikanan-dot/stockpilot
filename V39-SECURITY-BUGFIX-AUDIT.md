# StockPilot v39 — Bugfix & Security Hardening

Bu versiya v38 üzərindən ümumi kod auditi, bug fix və security hardening pass-dır.

## Security düzəlişləri

- Auth sessiyası artıq yeni login/register zamanı `localStorage` token ilə deyil, `HttpOnly + Secure + SameSite=Strict` session cookie ilə işləyir.
- Köhnə Bearer tokenləri qısa migrasiya uyğunluğu üçün server tərəfdə qəbul olunur; yeni frontend onları saxlamır.
- JWT imzası base64url formatına keçirilib və signature müqayisəsi constant-time tipli müqayisə ilə sərtləşdirilib.
- 4 rəqəmli PIN saxlanıldığı üçün login/register endpoint-lərinə D1 əsaslı brute-force rate limiting əlavə olunub.
- PBKDF2 yeni hesablar üçün 210,000 iterasiyaya qaldırılıb; köhnə 100,000-iterasiya hash uğurlu login zamanı avtomatik upgrade olunur.
- Unsafe POST/PUT/DELETE API çağırışlarında same-origin Origin yoxlaması əlavə olunub.
- Global security headers əlavə olunub: CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy və COOP.
- Inline `order-success` JavaScript ayrıca fayla çıxarılıb ki CSP `unsafe-inline` tələb etməsin.
- Profil şəkli upload yalnız JPG/PNG/WEBP, maksimum 4 MB qəbul edir; SVG/HTML kimi aktiv content bloklanır.
- Şəkil serving endpoint-i yalnız təhlükəsiz image MIME-ları qaytarır.
- Public order / delivery quote / tracking endpoint-lərinə rate limit əlavə olunub.
- Public order body ölçüsü, cart uzunluğu, məhsul sayı, telefon, delivery/payment enum və tarix limitləri sərtləşdirilib.
- Store API artıq fiziki stok sayını public response-da vermir.
- AI Alış external product fetch yalnız allowlist seller domain-lərinə icazə verir; arbitrary URL/SSRF riski azaldılıb.
- AI scan endpoint-lərinə rate limit əlavə olunub.
- User-to-user notification göndərilməsinə rate limit əlavə olunub.
- State JSON üçün depth/string/number/array safety validation əlavə olunub.

## Bug fixlər

- Notification cədvəl/index D1 migration race condition ardıcıl migration-a keçirildi.
- Müştəri sifarişi `delivered -> başqa status -> delivered` ediləndə stok/satışın iki dəfə yazılması bağlandı.
- Delivered və cancelled sifarişlər terminal status kimi qorunur.
- Korlanmış `customer_orders.order_json` və notification `data_json` artıq bütün endpoint-i 500 etdirmir; invalid row təhlükəsiz skip/error edilir.
- AI Alış bir request-də həddən artıq external subrequest yaradıb Cloudflare limitinə düşə bilərdi. Scan batch və source verification sayı təhlükəsiz həddə endirildi.
- AI yalnız approved seller səhifələrini verification üçün fetch edir.
- Product image URL-ləri render olunmazdan əvvəl data/same-origin image allowlist-dən keçirilir.
- Excel import maksimum 5 MB və 5,000 sıra ilə məhdudlaşdırılıb.
- Məhsul şəkli frontend-də maksimum 8 MB və JPG/PNG/WEBP ilə məhdudlaşdırılıb.
- Popup bloklananda qiymət təklifi funksiyası artıq JS error vermir, istifadəçiyə feedback göstərir.
- `order-success.html` CSP ilə uyğunlaşdırılıb.

## Deploy üçün vacib

Cloudflare Worker-də `AUTH_SECRET` güclü random secret olmalıdır və repo daxilində saxlanmamalıdır:

```bash
wrangler secret put AUTH_SECRET
```

D1 schema-da `security_rate_limits` cədvəli əlavə olunub. Worker runtime cədvəli özü də yaradır, amma yeni deploy üçün `schema.sql` yenilənib.

## Qalan risklər

- 4 rəqəmli PIN UX tələbinə görə saxlanılıb. Rate limit riski ciddi azaldır, amma 4 rəqəmli PIN uzun paroldan zəifdir.
- QR şəkli hələ `api.qrserver.com` üzərindən yaradılır. Tracking səhifəsi ad/telefon/tam ünvan göstərmir, amma QR provider tracking URL-i texniki olaraq görə bilər. Tam privacy üçün gələcək versiyada local QR generator bundle etmək daha yaxşıdır.
- Leaflet və SheetJS CDN-dən yüklənir. CSP yalnız konkret domenlərə icazə verir, amma maksimum supply-chain security üçün kitabxanaları lokal bundle etmək olar.
