# StockPilot v45 — UI/UX yenilənməsi

Mövcud tünd fon və lime rəng palitrası saxlanılıb. Dəyişikliklər əsasən iş panelinin quruluşuna aiddir.

- Alış siyahısı seçimi açılan menyuya keçirilib; seçilmiş siyahının adı və əsas göstəricilər yuxarıda görünür.
- Məhsul əlavə/redaktə forması sağdan açılan panelə keçirilib. Escape ilə bağlanır; N düyməsi yeni məhsul panelini açır.
- Axtarış və status filtri həmişə görünür. Siyahı ayarları ayrıca açılır.
- Mobil məhsul cədvəli məlumat etiketləri olan kartlara çevrilib; əsas maliyyə məlumatları saxlanılıb.
- Rahat/yığcam görünüş seçimi cihazda yadda saxlanılır.
- Müştəri sifarişlərində ad, telefon və sifariş nömrəsi üzrə axtarış əlavə edilib. Kanban sütunları mobil ekranda üfüqi sürüşdürülür.
- Stok ekranında say/ad sıralaması, nəticə sayı və “Stok bitib” filtri əlavə edilib. Bitmiş məhsullar yenidən stok artırmaq üçün görünür.
- AI alış kartlarında maya və potensial fərq daha aydın qruplaşdırılıb; izləmə ayarları açılan bölmədədir. Xətalı yoxlamalar ayrıca filtrlənir.
- Profil bölmələri arasında keçid, klaviatura fokusları və toxunma sahələri təkmilləşdirilib.

## Yoxlama

`npm test`: 40 test keçdi. Buraya əvvəlki backend/AI regressiya testləri, səhifələrin yerli fayl istinadları, JavaScript sintaksisi və bitmiş stokun satış tarixçəsi qorunaraq artırılması daxildir.

Brauzer vizual və interaktiv yoxlaması bu mühitdə Chromium olmadığı üçün icra edilməyib. `npm run test:browser` ssenarisi yeni siyahı ayarları quruluşuna uyğunlaşdırılıb, lakin bu versiyada icra olunmayıb. Mobil ölçülər və panel davranışları canlıya çıxarılmazdan əvvəl brauzerdə yoxlanmalıdır.

Bu paket canlı sistemə yerləşdirilməyib. V44 backend və AI düzəlişləri paketdə saxlanılıb; bu mərhələdə AI-nin canlı xarici mənbələri yenidən yoxlanılmayıb. Əvvəlki texniki məhdudiyyətlər üçün V44-BUGFIX-REPORT.md faylına baxın.
