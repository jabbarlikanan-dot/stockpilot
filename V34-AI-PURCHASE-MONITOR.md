# StockPilot v34 — AI Alış Köməkçisi

## Yeni modul
`ai-purchases.html` ayrıca alış monitorudur.

- Stokdakı məhsullar avtomatik izləmə siyahısına əlavə olunur.
- Hər məhsul üçün cari alış + karqo maya dəyəri hesablanır.
- Pulsuz açıq web axtarışı ilə uyğun məhsul səhifələri tapılmağa çalışılır.
- Məhsul səhifəsində JSON-LD / OpenGraph / qiymət metadata-sı varsa qiymət oxunur.
- Mövcud ölkə valyuta və karqo tarifləri ilə AZN maya dəyərinə çevrilir.
- Ən ucuz 5 təklif saxlanır.
- `İndi yoxla` və `Hamısını yoxla` əməliyyatları var.
- Hər məhsul üçün `Daim izlə` və bildiriş həddi (%) var.
- Default bildiriş həddi: 8% qənaət.
- Daha yaxşı qiymət tapıldıqda `ai-price` tipli StockPilot bildirişi yaradılır.
- Bildirişdən AI Alış səhifəsində məhsula keçmək mümkündür.

## Daimi işləmə
`wrangler.jsonc` daxilində Cloudflare Cron Trigger əlavə edildi:

`0 */6 * * *` — hər 6 saatdan bir.

Hər cron dövründə limitli sayda ən köhnə yoxlanmış aktiv məhsul seçilir. Bu, pulsuz Worker limitlərini qorumaq və bir run-da həddən artıq xarici sorğu yaratmamaq üçündür.

## Ödənişli AI API yoxdur
Bu versiya OpenAI/ChatGPT API istifadə etmir. Məhsul uyğunluğu və qiymət müqayisəsi qayda əsaslı smart monitor kimi işləyir.

Açıq axtarış və mağaza səhifələri avtomatik sorğuları bloklaya bilər. Belə halda sistem qiymət uydurmur və həmin mənbəni nəticəyə salmır.

## D1
Yeni cədvəllər:
- `ai_price_watch`
- `ai_price_offers`

Worker onları runtime-da `CREATE TABLE IF NOT EXISTS` ilə də yaradır. `schema.sql` da yenilənib.

## Yeni fayllar
- `ai-purchases.html`
- `ai-purchases.css`
- `ai-purchases.js`
- `v34.css`

## Yenilənən fayllar
- `worker.js`
- `schema.sql`
- `wrangler.jsonc`
- `notifications.js`
- əsas panel HTML-ləri — AI Alış sidebar və mobil keçidi üçün.
