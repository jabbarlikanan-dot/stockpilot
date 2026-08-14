# StockPilot v24 — UX/UI və kod auditi

## Düzəldilən kritik problemlər

- `inventory.js` `/api/state` endpoint-inə səhv body göndərirdi. Worker `{ state }` gözlədiyi halda raw state gedirdi. Stok dəyişikliklərinin serverdə saxlanması düzəldildi.
- Inventory məhsul şəkli üçün `item.image` istifadə edirdi, əsas sifariş modulu isə `item.img` saxlayırdı. Şəkillərin stok səhifəsində görünməməsi düzəldildi.
- Profil, dashboard və stok səhifəsində istifadəçi/məhsul adlarının bəzi `innerHTML` çıxışları escape olunmurdu. XSS riski azaldıldı; profil renderi DOM API-yə keçirildi, dinamik mətnlər escape edilir.
- Worker token parse zamanı malformed token üçün exception verə bilirdi. Auth parse qorundu və etibarsız tokenlər təhlükəsiz şəkildə 401 axınına düşür.
- `/api/state` üçün struktur və ölçü yoxlaması əlavə edildi; korlanmış və həddən artıq böyük state-in D1-ə yazılması bloklanır.
- `user_state` sətri yoxdursa və ya JSON korlanıbsa GET artıq crash etmir; təhlükəsiz default state qaytarılır.
- Public mağazada paralel sifarişlər stokdan artıq satış yarada bilirdi. `new/confirmed/preparing/courier` statuslu sifarişlər rezerv stok kimi hesablanır və mağazada əlçatan saydan çıxılır.

## UX/UI təkmilləşdirmələri

- Ortaq toast feedback sistemi əlavə edildi.
- Stokda satış sayı üçün native prompt əvəzinə responsive dialog əlavə edildi.
- Offline vəziyyət üçün görünən status və xəbərdarlıq əlavə edildi.
- Klaviatura `focus-visible` vəziyyətləri yaxşılaşdırıldı.
- Mobil top action bar funksiyaları gizlədilmir; horizontal scroll ilə əlçatan qalır.
- Kiçik ekranlarda heading və modal davranışı yaxşılaşdırıldı.
- Mağaza səbəti backdrop, Escape ilə bağlanma, `aria-expanded/aria-hidden` və body scroll lock aldı.
- Checkout sahələrinə real label və autocomplete əlavə edildi.
- Çatdırılma üsuluna görə yalnız uyğun `Metro/rayon` və ya `Tam ünvan` sahəsi göstərilir və required vəziyyəti avtomatik dəyişir.
- Saat sahəsi sərbəst text əvəzinə native `time` input oldu.
- 380px-dən dar ekranlarda mağaza məhsulları bir sütuna keçir.
- Login və qeydiyyat submit düymələrinə loading/disabled vəziyyəti əlavə edildi.

## Təmizləmə

- `cargo.html` artıq yalnız dashboard-a redirect edir və heç yerdə istifadə olunmayan `cargo.js` silindi.
- Bütün JS faylları `node --check` ilə syntax yoxlamasından keçirildi.
- Bütün CSS fayllarında brace balansı yoxlanıldı.
- Lokal HTML asset referensləri yoxlanıldı.

## Qalan texniki borc / tövsiyə

- `orders.js` və `orders.css` çox böyük monolit fayllardır. Funksional risk yaratmamaq üçün bu paketdə tam modul parçalanması edilmədi; növbəti mərhələdə customer orders, import/export, product editor və settings ayrı modullara bölünməlidir.
- Destructive əməliyyatlarda bəzi native `confirm()` dialoqları saxlanılıb. Bunları dizayn sisteminə uyğun custom confirmation dialog ilə əvəz etmək olar.
- Excel import/export üçün SheetJS runtime CDN-dən yüklənir. Offline/PWA etibarlılığı üçün dependency-ni build zamanı lokal bundle etmək daha düzgündür.
- 4 rəqəmli PIN məhsul tələbi kimi saxlanılıb, amma təhlükəsizlik baxımından zəifdir. Production üçün daha uzun parol və login rate limiting tövsiyə olunur.
- Tam end-to-end test üçün real Cloudflare D1/Worker mühiti və test istifadəçiləri lazımdır; bu audit statik kod, frontend davranışı və Worker məntiqi üzərində aparılıb.
