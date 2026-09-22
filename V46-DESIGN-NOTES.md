# StockPilot v46 — yeni dizayn

Rəng palitrası saxlanılıb. Mağaza və idarəetmə ekranları vahid ölçü, boşluq və kart sistemi ilə yenilənib.

## Dəyişikliklər

- Masaüstündə alış siyahısı, stok, AI kartları və müştəri siyahısı 4 sütunlu griddədir. Dar ekranlarda 2 və ya 1 sütuna keçir. Göstəricilər və çatdırılma ayarları da 4 sütunlu quruluşdan istifadə edir.
- Alış cədvəli həqiqi məhsul kartları ilə əvəzlənib. Favori, detallar, satış, geri alma, redaktə və silmə düymələri qorunub.
- Stok kartlarında şəkil, başlıq, vəziyyət və əməliyyat hissələri ayrılıb; düymələr kartın daxilində qalır.
- Ağ görünən məhsul paneli düzəldilib: tünd fon, uyğun sahələr, mobil tam ekran və Escape ilə bağlanma.
- Mağazaya yeni giriş bölməsi, qrafik kompozisiya, sifariş addımları, ayrıca axtarış/filtr sətri, 4 sütunlu kataloq və yenilənmiş səbət görünüşü əlavə edilib.
- Profil 1+3 sütunlu quruluşa, çatdırılma sahələri isə 4 sütunlu düzülüşə keçirilib.
- Mobil axtarışın böyüməsi, kartdan daşan elementlər və gizlədilməli bildiriş nişanları düzəldilib.

## Xətanın səbəbi

V45 experience.css-də iki grid qaydasında bağlanan mötərizə çatışmırdı. Bundan əlavə, əvvəlki CSS versiyalarının bir-birini üstələyən qaydaları yeni düzülüşə mane olurdu. Sintaksis düzəldilib; əvvəlki görünüş qaydaları ayrıca aşağı-prioritet CSS qatına keçirilib və yeni dizaynın ölçüləri vahid yerdə müəyyənləşdirilib.

## Yoxlamalar

- npm test: 40 test keçdi.
- Chromium brauzer yoxlaması: 14 səhifənin açılması, məlumatın saxlanması, iki səhifə arasında konflikt, fərqli ID ilə dublikat, yükləmə xətası, mobil səhifələr və səbət keçdi.
- Layout ssenarisi: 360, 390, 768, 1024, 1440 və 1920 px enlərində 6 əsas səhifənin sütun sayı və üfüqi daşması yoxlanıldı. Kart düymələrinin yerləşməsi, axtarış sahəsinin ölçüsü, panelin tünd fonu, açılıb bağlanması, məhsul redaktəsi və səbət də yoxlanıldı.
- preview qovluğundakı şəkillər yerli test məlumatları ilə çəkilmiş brauzer görüntüləridir; real mağazanın məlumatları deyil. Məhsul şəkli olmayan vəziyyət də göstərilir.

Brauzer testlərini təkrarlamaq üçün Node.js 22.13+ və Playwright/Chromium lazımdır. Layihə qovluğunda npm install --no-save playwright, npx playwright install chromium, sonra npm run test:browser və npm run test:layout işlədilə bilər. Mövcud Chromium üçün PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH verilə bilər.

Bu paket canlıya yerləşdirilməyib. Backend V44 düzəlişlərini saxlayır; xarici AI qiymət mənbələri və xəritə xidməti bu yerli sınaqlarda şəbəkəyə qoşulmayıb. Əvvəlki hesabatlardakı canlı xidmət məhdudiyyətləri qüvvədədir.
