# StockPilot v32 — Backorder / stok bitəndə də sifariş

- Mağazada stok 0 olsa belə məhsul sifarişə açıq qalır.
- Məhsul kartında stokun bitməsi səbəbilə düymə deaktiv edilmir.
- Müştəri səbətdə həmin məhsulun sayını artıra bilir; fiziki stok miqdarı sifarişi bloklamır.
- Worker artıq sifariş yaradılarkən `quantity > stock` şərti ilə 409 qaytarmır.
- Çatdırılmış sifariş stokdan mümkün qədər çıxılır və stok 0-dan aşağı düşmür.
- Satış hesabatında isə faktiki sifariş edilmiş/çatdırılmış tam miqdar qeyd olunur; beləliklə backorder satışları itmir.
- Məhsul yalnız sistemdə açıq şəkildə `sold` kimi işarələnibsə storefront sifarişindən kənarda qalır.
