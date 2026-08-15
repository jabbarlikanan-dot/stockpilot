# StockPilot v40 — Auth + D1 compatibility migration

Bu versiya mövcud D1 bazasını silmədən köhnə auth schema-larını yeni Worker ilə uyğunlaşdırır.

## Düzəlişlər
- Köhnə `users.photo_text` schema-sı olan bazalarda `photo_key` avtomatik `ALTER TABLE` ilə əlavə edilir.
- `created_at` yoxdursa avtomatik əlavə olunur.
- Köhnə mixed-case username-lər üçün NOCASE indeks yaradılır.
- Login köhnə raw PBKDF2-100k hash-ləri qəbul edir və uğurlu girişdə PBKDF2-210k formatına upgrade edir.
- Keçid build-lərində prefixsiz 210k hash də uyğunlaşdırılır.
- Yalnız dəqiq 4 rəqəmli literal legacy PIN formatı aşkar olunarsa bir dəfə qəbul edilir və dərhal təhlükəsiz hash-ə migrate olunur.
- Yeni qeydiyyat mövcud köhnə D1 cədvəlində işləyir.
- `IMAGES` binding yoxdursa optional profil şəkli qeydiyyatı bloklamır; hesab yenə yaradılır.
- Username yoxlamaları case-insensitive saxlanılıb.

## Deploy
Mövcud `stockpilot-db` D1 binding-i saxlanmalıdır. Yeni database yaratmayın.

`AUTH_SECRET` mövcud Secret olaraq qalmalıdır.

Deploy:

```bash
npx wrangler deploy
```

Deploy-dan sonra ilk `/api/register` və ya `/api/login` sorğusu schema migration-u avtomatik tətbiq edir.
