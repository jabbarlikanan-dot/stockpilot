# StockPilot v43 — Auth Final

Kök səbəb: 210k PBKDF2 Cloudflare request path üçün ağır və kövrək idi. Yeni hesablar v3 HMAC-SHA256 istifadə edir: server-side AUTH_SECRET + per-user random salt + rate limit.

## Deploy
npx.cmd wrangler deploy

## Mövcud `krenz` PIN reset
node reset-pin.mjs krenz
npx.cmd wrangler d1 execute stockpilot-db --remote --file reset-pin.sql

İlk uğurlu login reset hash-i avtomatik v3 HMAC formatına upgrade edir.
