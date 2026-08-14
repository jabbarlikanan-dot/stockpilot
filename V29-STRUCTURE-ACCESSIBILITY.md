# StockPilot v29 — Structure & Accessibility

Bu versiyada vizual palitra saxlanılıb, əsas dəyişiklik **informasiya arxitekturası, scanability, responsive davranış və accessibility** üzərindədir.

## Struktur
- Sidebar daha aydın bölmələrə ayrılır: gündəlik işlər, məhsullar, hesab/sistem.
- Aktiv səhifə həm vizual, həm `aria-current` ilə göstərilir.
- Topbar ikinci dərəcəli kontekst roluna salınıb; page heading əsas vizual anchor-dır.
- Content eni və vertikal ritm standartlaşdırılıb.
- Dashboard-da action queue daha önəmli, KPI blokları secondary səviyyəyə keçirilib.
- Müştəri sifarişləri səhifəsində təkrarlanan ikinci başlıq gizlədilib.
- Inventory toolbar sticky task zone kimi işləyir; stok kartları daha scan-friendly horizontal struktura keçirilib.

## Mobil / tablet
- Desktop strukturunun sadəcə kiçildilməsi əvəzinə ayrıca mobil davranış tətbiq edilib.
- Operations Hub-da action queue mobil ekranda əvvəl görünür.
- Inventory action-ları böyük toxunma sahələri ilə alt sətrə keçir.
- Board sütunlarında horizontal snap davranışı var.
- Əsas toxunma elementləri minimum 44px ölçüyə yaxınlaşdırılıb.

## Accessibility
- “Əsas məzmuna keç” skip-link.
- Gücləndirilmiş `focus-visible`.
- Sidebar toggle üçün `aria-controls`, `aria-expanded` və dinamik label.
- Aktiv nav üçün `aria-current`.
- Filter və layout düymələri üçün `aria-pressed`.
- Modal/inspector üçün `role=dialog`, `aria-modal`, `aria-labelledby`.
- Modal focus trap, Escape ilə bağlanma və bağlandıqda əvvəlki elementə focus qaytarılması.
- Placeholder-only axtarış sahəsinə accessible label.
- Dynamic KPI/state sahələrində `aria-live=polite`.
