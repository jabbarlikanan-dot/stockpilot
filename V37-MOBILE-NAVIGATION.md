# StockPilot v37 — Mobile Navigation Pass

## Problem
Mobil görünüşdə desktop topbar gizlənirdi, amma onun yerinə tam mobil header gəlmirdi. Nəticədə mağaza, bildirişlər, səhifə konteksti və əsas menyu telefonda zəif əlçatan idi.

## Həll
- ayrıca mobile topbar: burger + StockPilot + səhifə adı + bildiriş + profil
- burger drawer:
  - Şəxsi sifarişlər
  - Müştəri sifarişləri
  - Stok
  - Mağazam
  - AI Alış
  - Bildirişlər
  - Profil/Hesab
  - Çıxış
- bottom nav bütün daxili səhifələrdə eyni 5 elementə normallaşdırılır:
  - Sifarişlər
  - Stok
  - Əlavə et
  - Mağaza
  - Hesab
- AI Alış və Bildirişlər burger/topbar vasitəsilə əlçatandır; bottom nav lazımsız sıxlaşdırılmır.
- notification badge mobil bell ikonuna sinxronlaşdırılır.
- mobil heading ölçüsü bir qədər azaldılıb.
