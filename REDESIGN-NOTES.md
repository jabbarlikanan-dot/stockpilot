# StockPilot UI/UX Redesign

## Vizual istiqamət
- Mövcud StockPilot rəng kimliyi saxlanılıb: tünd/qara fon + lime yaşıl accent.
- Bütün daxili səhifələr üçün vahid radius, border, shadow, spacing və form sistemi əlavə olunub.
- Sidebar daha premium, aktiv vəziyyətlər daha aydın və kompakt rejim daha səliqəli edilib.
- Sticky/top glass toolbar, yeni kart səthləri və daha yaxşı vizual hierarchy əlavə olunub.
- Dashboard/orders cədvəl, tab, metric, modal və form komponentləri yenilənib.
- Inventory kartları, low-stock state və mobil görünüş gücləndirilib.
- Login/register ekranı eyni rənglə daha premium SaaS görünüşünə keçirilib.
- Mobile bottom navigation və touch target-lar böyüdülüb.

## Yeni UX funksiyaları
- Ctrl+K / Cmd+K: sürətli səhifə naviqasiyası.
- `/`: stok/axtarış input-u olan səhifədə birbaşa axtarışa fokus.
- Escape: command palette-i bağlayır.
- Reduced-motion preference dəstəyi.
- 760px və 480px breakpoint-lərində ayrıca mobile layout optimizasiyası.
- Cədvəllər mobil ölçüdə horizontal scroll ilə qorunur, layout qırılmır.

## Fayllar
- `redesign.css` — yeni vahid design layer.
- `redesign.js` — əlavə keyboard/power UX.
- Mövcud HTML-lər bu layer-i son stylesheet kimi yükləyir; buna görə köhnə funksionallıq saxlanılır.
