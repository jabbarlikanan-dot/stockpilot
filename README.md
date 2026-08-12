# StockPilot — yekun user və sifariş sistemi

Bu paket **static upload üçün deyil**. Fərdi hesabların, şifrələrin, sifarişlərin və statistikanın telefonla digər kompüterdə də eyni qalması üçün Cloudflare Worker + D1 database ilə deploy edilməlidir.

## Quraşdırma

1. Cloudflare-də `stockpilot-db` adlı D1 database yaradın.
2. `stockpilot-images` adlı R2 bucket yaradın.
3. `wrangler.jsonc` faylında `REPLACE_WITH_D1_DATABASE_ID` hissəsini yeni D1 database ID-si ilə əvəz edin.
4. Worker Settings → Variables and Secrets hissəsində `AUTH_SECRET` yaradın. Uzun, təsadüfi bir mətn yazın (ən azı 32 simvol).
5. D1 Console-da `schema.sql` faylının içini işə salın.
6. Layihəni `wrangler deploy` ilə, yaxud Cloudflare Worker-in kod redaktoru vasitəsilə Worker kimi deploy edin.

`public/` saytın görünən hissəsidir. `src/worker.js`, `schema.sql` və `wrangler.jsonc` silinməməlidir.

## Nəticə

- Hər username ayrı profildir.
- Sifariş, məhsul, foto və statistika həmin userə məxsusdur.
- İstənilən cihazdan eyni username və 4 rəqəmli şifrə ilə giriş etmək olur.
- “Satıldı et” seçimi satış tarixini saxlayır; statistika gün/həftə/ay/il üzrə bu məlumatlardan hesablanır.
<!-- build trigger -->
