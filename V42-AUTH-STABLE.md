# StockPilot v42 — Auth Stable

- PIN hash vahid `v2:iterations:salt:hash` formatına keçirildi.
- Login, register və reset eyni PBKDF2-SHA256 məntiqindən istifadə edir.
- Köhnə raw, `pbkdf2$...` və literal PIN formatları migration üçün dəstəklənir.
- Uğurlu legacy login avtomatik v2 formatına upgrade olunur.
- `/api/version` endpoint-i əlavə edildi; deploy-dan sonra `https://...workers.dev/api/version` => `42.0.0` olmalıdır.
- `reset-pin.mjs` flat strukturda `reset-pin.sql` yaradır.
