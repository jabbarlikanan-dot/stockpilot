# StockPilot v44 — bug düzəlişləri və yoxlama hesabatı

Bu paket təqdim edilən v43 arxivinin üzərində hazırlanıb. Yeni dizayn və yeni AI xidməti əlavə edilməyib. Mövcud Cloudflare Worker + D1 quruluşu saxlanılıb.

## Əsas düzəlişlər

### AI alış səhifəsinin açılmaması

`shell.js` alt menyunu yenidən qurarkən `mobileStoreLink` elementini silirdi. `ai-purchases.js` asinxron cavabdan sonra olmayan elementin `href` sahəsinə yazırdı; nəticədə səhifənin yüklənməsi dayanırdı. Element mövcudluğu yoxlanır. Bu vəziyyət ayrıca avtomatik sınaqda təkrarlanıb və düzəliş təsdiqlənib.

### Saxlama və məlumat itkisi

- Məlumat yüklənməyəndə boş siyahı ilə redaktəyə başlanmır.
- GET `/api/state` versiya qaytarır. PUT həmin versiyanı və verilənlər bazasındakı əvvəlki JSON-u yoxlayır; köhnə səhifə yeni məlumatı əvəz etmir.
- Brauzer saxlama sorğularını ardıcıl göndərir; uğursuz əməliyyat görünən bildiriş yaradır.
- Saxlanmamış dəyişikliklər həmin tabın sessionStorage yaddaşında saxlanır. “Dəyişiklikləri endir” JSON nüsxəsini verir; konflikt zamanı avtomatik birləşdirmə aparılmır. Tab bağlananda bu yaddaşın qalacağına güvənməyin; JSON-u endirin.
- İnventar səhifəsində uğursuz dəyişiklik təsdiqlənmiş vəziyyətə qaytarılır; saxlanmamış nüsxə ayrıca bərpa üçün saxlanır.
- Korlanmış JSON səssizcə boş siyahıya çevrilmir.
- Saxlama ölçüsü üçün UTF-8 baytları hesablanır; 1.8 MB tətbiq limiti aydın xəta ilə göstərilir. Böyük kataloq üçün şəkillərin ayrıca saxlanması və ayrıca məhsul cədvəllərinə keçid hələ gələcək işdir.

### Sifariş, stok, satış

- Tamamlama zamanı stok, satış qeydi və sifariş statusu D1 batch tranzaksiyası ilə birlikdə dəyişir. Tranzaksiyadan əvvəl oxunmuş stok/status dəyişibsə əməliyyat dayandırılır.
- Təkrar “çatdırıldı” sorğusu ikinci satış yaratmır.
- Checkout təkrar göndərişlərində eyni sorğu açarı ikinci sifariş yaratmır.
- Satış məbləği sifarişin təsdiqlənmiş qiymətindən hesablanır. Yeni sifarişlərdə vahid maya dəyəri də saxlanır; köhnə sifarişlərdə mövcud məlumat əsasında hesablanır.
- Karqo ümumi partiya çəkisinə görə hesablanıb ilkin say arasında bölünür. Tarif/məzənnə qaydaları ortaq `domain.js` modulundadır.
- Yeni şəxsi satış hadisələri satış və maya məbləğini saxlayır. Keçmişdə saxlanmamış maya/qiymət tarixçəsini etibarlı şəkildə bərpa etmək mümkün deyil; köhnə hadisələrdə mövcud qiymətlərdən istifadə olunur.
- Məhsul dublikatına yeni ID verilir; köhnə təkrarlanan ID-lər oxunarkən sabit fərqli ID-lərə çevrilir.
- Mənfi qiymət/say, kəsr say, təkrarlanan ID və səhv tariflər yoxlanır.
- Sifarişin məhsulu silinibsə, sistem satış yaratmadan tamamlamağı dayandırır.
- Stokdan artıq sifariş (backorder) saxlanılıb; tamamlama zamanı fiziki stok sıfırdan aşağı düşmür, çatdırılmış miqdar satışa yazılır.
- Sifariş yaradıldıqdan sonra bildiriş yazılmasa, yaradılmış sifariş “uğursuz” qaytarılmır.

### AI qiymət monitoru

- Axtarış nəticəsinin başlığı məhsul səhifəsindəki uyğunsuz çəkiyə haqq qazandırmır.
- Qram, kiloqram, lb və oz çevrilmələri müqayisəyə daxil edilir. Adın ölçüdən başqa identifikasiya sözləri və model rəqəmləri də uyğun olmalıdır.
- Qiymət yalnız uyğun Product obyektinin Offer məlumatından götürülür; əlaqəsiz aksesuarın qiyməti, variantlar üzrə AggregateOffer/lowPrice və stokda olmayan təklif qəbul edilmir.
- Valyuta açıq göstərilməlidir. Valyuta məzənnəsi yoxdursa qiymət uydurulmur; səbəb göstərilir.
- `1.299,90` və `1,299.90` kimi formatlar oxunur.
- Təxmini karqo tapılan mənbəyə uyğun dəstəklənən marşrutla hesablanır; köhnə stok qeydinin ölkəsi avtomatik köçürülmür.
- “Hamısını yoxla” səhifələnmiş sorğularla bütün aktiv qeydləri gəzir. Uğursuz yoxlamalar ayrıca sayılır. Bu əl ilə başlanmış dövrün davam etməsi üçün səhifə açıq qalmalıdır.
- Fon cron-u hər 5 dəqiqə 6 saatdan köhnə ən çox 3 qeydi götürür. Çox böyük ümumi növbədə hər məhsulun dəqiq 6 saata yenilənməsi zəmanəti yoxdur.
- Yeni yoxlama uğursuz/nəticəsizdirsə köhnə ən yaxşı qiymət cari qiymət kimi saxlanmır.
- Silinmiş məhsullar izləmədən çıxarılır; 0% bildiriş həddi artıq 8%-ə çevrilmir.
- Xarici sorğulara vaxt, cavab ölçüsü və satıcı yönləndirmə yoxlamaları əlavə olunub.
- Köhnə versiyanın yoxlanılmamış təklifləri ilk yenilənmədə silinir və yenidən axtarılır.

Bu hələ **ödənişli AI modeli deyil**, açıq səhifələrə əsaslanan qiymət monitorudur. Satıcıların bot blokları, CAPTCHA, JavaScript ilə göstərilən qiymətlər və axtarış səhifəsinin struktur dəyişiklikləri səbəbindən nəticə olmaya bilər. Təklifin görünməməsi bazarda ucuz variant olmadığı demək deyil. Yalnız məlum ABŞ/USD və Türkiyə/TRY marşrutları avtomatik qiymətləndirilir; digər ölkə/valyuta kombinasiyalarında uydurma karqo hesablanmır. Satıcının daxili çatdırılması, vergilər, gömrük, əlavə komissiyalar və faktiki qablaşdırma çəkisi yekun təxminə daxil deyil. Canlı mənbələr bu mühitdən başdan sona yoxlanmayıb.

### Digər düzəlişlər

- Həftəlik qrafik bütün tarixlərin eyni həftə gününü toplamaq əvəzinə cari həftəni göstərir.
- İnventarın alış dəyəri AZN-ə çevrilir və karqo payını nəzərə alır.
- Profil şifrəsi dəyişəndə əvvəlki giriş tokenləri etibarsızlaşır. İlk v44 yenilənməsindən sonra əvvəlki istifadəçilər bir dəfə yenidən daxil olmalıdır.
- Şifrə dəyişməsi yeni hesablarla eyni v3 mexanizmindən istifadə edir; əlavə sorğu limiti var. Mövcud 4-rəqəmli PIN modeli bu bugfix paketində dəyişdirilməyib.
- Keçmiş saat və mövcud olmayan tarix Bakı vaxtına görə yoxlanır; gecə yarısına yaxın standart çatdırılma vaxtı düzgün günə keçir.
- Boş xəritə koordinatı `(0,0)` kimi hesablanmır. Köhnə gecikmiş çatdırılma cavabı yeni seçimi əvəz etmir.
- Mövcud sifarişdə çatdırılma üsulunu dəyişmək əlavə koordinat və qiymət tələb etdiyindən açıq xəta ilə dayandırılır; dəyişdirilmiş vaxt üçün ünvan tarifi yenidən hesablanır.
- Məhsul şəklini siləndə render köhnə şəkli geri qaytarmır; oxunmayan şəkil üçün xəta verilir.
- Excel vərəq adları unikal və etibarlı edilir; import 5000 məhsul həddini keçmir.
- Bildiriş siyahısı yenilənəndə yazılmaqda olan mesaj mətni qorunur.
- API xətaları üçün JSON cavabı və izləmə ID-si var. Naməlum API 404 qaytarır.
- Worker bütün statik cavabların təhlükəsizlik başlıqlarını tətbiq edir; kod/schema/test və diaqnostika faylları açıq aktivlərə daxil edilmir. Hesaba aid hazır `reset-pin.sql` paketdən çıxarılıb.

## Yoxlama nəticəsi

- `npm test`: **39 test keçdi, 0 uğursuz**.
- 20 əsas JS/MJS faylının sintaksisi yoxlanıb.
- HTML-lərdə yerli fayl keçidləri yoxlanıb; eyni səhifədə yüklənən klassik skriptlərdə təkrarlanan qlobal deklarasiya yoxdur.
- Worker testləri real in-memory SQLite üzərində D1 metodlarını modelləşdirən adapterlə işləyir; bunlar canlı Cloudflare testləri deyil.
- Qiymət nümunələri və şəbəkə xətaları nəzarətli sınaqlardır; xarici mağazalara sifariş və bildiriş göndərilməyib.
- Brauzer smoke testi `tests/browser-smoke.mjs` daxilindədir, amma Chromium olmadığı və yükləmə bağlantısı vaxtı bitdiyi üçün bu mühitdə **işlədilmədi**. Mobil ölçü/layout və canlı brauzer axınlarını təsdiqlənmiş hesab etməyin.
- Canlı sayt və verilənlər bazası dəyişdirilməyib, deploy edilməyib.

## Quraşdırma / yeniləmə

1. Mövcud D1 məlumat bazasının ehtiyat nüsxəsini alın. Paket real məlumat bazanızı ehtiva etmir.
2. Arxivdəki layihə qovluğunun bütün fayllarını birlikdə köhnə layihənin yerinə qoyun. Yalnız `worker.js` dəyişmək kifayət deyil: yeni saxlama protokolu frontend ilə birlikdə işləyir.
3. `wrangler.jsonc`-dəki DB ID və Worker adı mövcud layihəniz üçün qorunub. `AUTH_SECRET` mövcud dəyərində qalsın; bu versiya həmin secret-dən istifadə edən PIN-ləri saxlayır.
4. `npx wrangler deploy` (Windows üçün `npx.cmd wrangler deploy`). v44 əlavə cədvəl/sütunları avtomatik yaradır; mövcud cədvəlləri silmir. Təmiz quraşdırma üçün `schema.sql` də mövcuddur.
5. Açıq tabları yeniləyin və yenidən daxil olun. Köhnə frontend-in saxlama sorğuları 409 ilə bloklanacaq.
6. Lirə qiymətlərini müqayisə etmək istəyirsinizsə Worker dəyişəni `FX_TRY_AZN` təyin edin: **1 TRY neçə AZN-dir**. Bu rəqəm avtomatik məzənnə xidməti deyil; aktual dəyəri özünüz yeniləməlisiniz. Türkiyə karqo tarifinin `$` valyutasını lirəyə çevirmək lazım deyil — onlar ayrı hesablamalardır.
7. AI səhifəsində “Hamısını yoxla” ilə qiymətləri yenidən toplayın. Məhsul adında brend, tam model və ölçü yazın.

Test üçün Node.js 22.13+ (bu paket Node.js 24-də yoxlanılıb):

```sh
npm test
```

İstəyə bağlı real brauzer smoke testi:

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

## Texniki istinad

D1 batch tranzaksiya/rollback davranışı üçün [Cloudflare D1 Database sənədi](https://developers.cloudflare.com/d1/worker-api/d1-database/), aktivlərin Worker üzərindən verilməsi üçün [Worker script routing sənədi](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) əsas götürülüb.
