const json = (x, s = 200) =>
    new Response(JSON.stringify(x), {
      status: s,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "same-origin",
      },
    }),
  fail = (e, s = 400) => json({ error: e }, s),
  enc = new TextEncoder();
const b64 = (x) => btoa(String.fromCharCode(...new Uint8Array(x))),
  from64 = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
async function hash(p, s) {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(p),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return b64(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: from64(s), iterations: 100000, hash: "SHA-256" },
      k,
      256,
    ),
  );
}
async function mac(x, s) {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(s),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64(await crypto.subtle.sign("HMAC", k, enc.encode(x)));
}
async function issue(u, s) {
  const h = btoa('{"alg":"HS256","typ":"JWT"}'),
    p = btoa(JSON.stringify({ sub: u.id, exp: Date.now() + 6048e5 }));
  return `${h}.${p}.${await mac(`${h}.${p}`, s)}`;
}
async function who(r, e) {
  try {
    if (!e.AUTH_SECRET) return null;
    const v = (r.headers.get("authorization") || "").split(" "),
      [h, p, signature] = (v[1] || "").split(".");
    if (v[0] !== "Bearer" || !h || !p || !signature) return null;
    const expected = await mac(`${h}.${p}`, e.AUTH_SECRET);
    if (signature !== expected) return null;
    const t = JSON.parse(atob(p));
    if (!t?.sub || !Number.isFinite(Number(t.exp)) || Number(t.exp) < Date.now()) return null;
    return e.DB.prepare("SELECT * FROM users WHERE id=?").bind(t.sub).first();
  } catch {
    return null;
  }
}
const pub = (u) => ({
  id: u.id,
  username: u.username,
  firstName: u.first_name,
  lastName: u.last_name,
  photo: u.photo_key ? `/api/images/${u.photo_key}` : null,
});
const readState = async (e, id) => {
  const row = await e.DB.prepare("SELECT state_json FROM user_state WHERE user_id=?").bind(id).first();
  if (!row?.state_json) return { orders: [], customerSales: [] };
  try {
    const value = JSON.parse(row.state_json);
    return value && typeof value === "object" && Array.isArray(value.orders) ? value : { orders: [], customerSales: [] };
  } catch {
    return { orders: [], customerSales: [] };
  }
};
const validateState = (state) => {
  if (!state || typeof state !== "object" || Array.isArray(state)) return "State düzgün formatda deyil.";
  if (!Array.isArray(state.orders)) return "Sifariş siyahısı düzgün formatda deyil.";
  if (state.orders.length > 2000) return "Sifariş sayı limitdən çoxdur.";
  for (const order of state.orders) {
    if (!order || typeof order !== "object" || !Array.isArray(order.items)) return "Sifariş məlumatı düzgün deyil.";
    if (order.items.length > 5000) return "Bir sifarişdə məhsul sayı limitdən çoxdur.";
  }
  const encoded = JSON.stringify(state);
  if (encoded.length > 8_000_000) return "Məlumat ölçüsü çox böyükdür.";
  return null;
};
const productList = (state, reserved = {}) =>
  (state.orders || []).flatMap((order) =>
    (order.items || []).map((item, index) => {
      const id = item.id || `${order.id}:${index}`;
      const physical = Math.max(0, Number(item.qty) || 0);
      return {
        id,
        name: item.name,
        category: item.category || "Digər",
        price: Number(item.sale) || 0,
        quantity: Math.max(0, physical - (Number(reserved[id]) || 0)),
        image: item.img || "",
        orderId: order.id,
        index,
        sold: Boolean(item.sold),
      };
    }),
  );
async function reservedStock(e, ownerId) {
  const rows = await e.DB.prepare("SELECT order_json FROM customer_orders WHERE owner_user_id=? AND status NOT IN ('delivered','cancelled')").bind(ownerId).all();
  const reserved = {};
  for (const row of rows.results || []) {
    try {
      const order = JSON.parse(row.order_json);
      for (const line of order.cart || []) {
        const id = String(line.id || "");
        if (!id) continue;
        reserved[id] = (reserved[id] || 0) + Math.max(0, Number(line.quantity) || 0);
      }
    } catch {}
  }
  return reserved;
}

const defaultStoreSettings = {
  originLat: 40.4093,
  originLng: 49.8671,
  originLabel: "Bakı mərkəz",
  // Bakı ride-hailing bazarına uyğun yumşaq default model.
  // Minimum 5 ₼, məsafə artımı isə əvvəlki versiyadan xeyli aşağıdır.
  baseFee: 3.2,
  perKm: 0.32,
  minFee: 5,
  morningMultiplier: 1.08,
  eveningMultiplier: 1.12,
  nightMultiplier: 1.08,
  weekendMultiplier: 1.05,
};
let storeSettingsSchemaReady;
function ensureStoreSettings(e) {
  if (!storeSettingsSchemaReady) {
    storeSettingsSchemaReady = e.DB.prepare(`CREATE TABLE IF NOT EXISTS store_settings (
      owner_user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      origin_lat REAL NOT NULL DEFAULT 40.4093,
      origin_lng REAL NOT NULL DEFAULT 49.8671,
      origin_label TEXT NOT NULL DEFAULT 'Bakı mərkəz',
      base_fee REAL NOT NULL DEFAULT 3.2,
      per_km REAL NOT NULL DEFAULT 0.32,
      min_fee REAL NOT NULL DEFAULT 5,
      morning_multiplier REAL NOT NULL DEFAULT 1.08,
      evening_multiplier REAL NOT NULL DEFAULT 1.12,
      night_multiplier REAL NOT NULL DEFAULT 1.08,
      weekend_multiplier REAL NOT NULL DEFAULT 1.05,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
  }
  return storeSettingsSchemaReady;
}
async function readStoreSettings(e, ownerId) {
  await ensureStoreSettings(e);
  const row = await e.DB.prepare("SELECT * FROM store_settings WHERE owner_user_id=?").bind(ownerId).first();
  if (!row) return { ...defaultStoreSettings };
  const settings = {
    originLat: Number(row.origin_lat), originLng: Number(row.origin_lng), originLabel: row.origin_label || "Mağaza",
    baseFee: Number(row.base_fee), perKm: Number(row.per_km), minFee: Number(row.min_fee),
    morningMultiplier: Number(row.morning_multiplier), eveningMultiplier: Number(row.evening_multiplier),
    nightMultiplier: Number(row.night_multiplier), weekendMultiplier: Number(row.weekend_multiplier),
  };
  const isLegacyDefault = Math.abs(settings.baseFee - 2.5) < .001 && Math.abs(settings.perKm - .75) < .001 && Math.abs(settings.minFee - 3.5) < .001;
  if (isLegacyDefault) return { ...settings, ...defaultStoreSettings, originLat: settings.originLat, originLng: settings.originLng, originLabel: settings.originLabel };
  // İstifadəçi minimumu daha aşağı yazsa belə sistem 5 ₼-dan aşağı qiymət vermir.
  settings.minFee = Math.max(5, settings.minFee || 0);
  return settings;
}
const clampNum = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
function haversineKm(aLat, aLng, bLat, bLng) {
  const rad = (d) => d * Math.PI / 180, R = 6371;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const q = Math.sin(dLat/2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}
async function roadDistanceKm(settings, lat, lng) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${settings.originLng},${settings.originLat};${lng},${lat}?overview=false&alternatives=false&steps=false`;
    const response = await fetch(url, { headers: { "user-agent": "StockPilot/1.0" } });
    const data = await response.json();
    const meters = Number(data?.routes?.[0]?.distance);
    if (response.ok && Number.isFinite(meters) && meters > 0) return meters / 1000;
  } catch {}
  return haversineKm(settings.originLat, settings.originLng, lat, lng) * 1.22;
}
function tariffForTime(settings, preferredAt) {
  const hour = Number(String(preferredAt || "").slice(11,13));
  const date = new Date(`${String(preferredAt || "").slice(0,10)}T12:00:00Z`);
  const weekend = [0,6].includes(date.getUTCDay());
  let multiplier = 1, periodLabel = "Standart tarif";
  if (hour >= 8 && hour < 10) { multiplier *= settings.morningMultiplier; periodLabel = "Səhər pik saatı"; }
  else if (hour >= 17 && hour < 20) { multiplier *= settings.eveningMultiplier; periodLabel = "Axşam pik saatı"; }
  else if (hour >= 22 || hour < 6) { multiplier *= settings.nightMultiplier; periodLabel = "Gecə tarifi"; }
  if (weekend) { multiplier *= settings.weekendMultiplier; periodLabel += " · həftəsonu"; }
  return { multiplier, periodLabel };
}
async function calculateDeliveryQuote(e, ownerId, lat, lng, preferredAt) {
  const settings = await readStoreSettings(e, ownerId);
  const distanceKm = await roadDistanceKm(settings, lat, lng);
  const { multiplier, periodLabel } = tariffForTime(settings, preferredAt);
  const raw = Math.max(settings.minFee, (settings.baseFee + distanceKm * settings.perKm) * multiplier);
  return { fee: Math.round(raw * 100) / 100, distanceKm: Math.round(distanceKm * 100) / 100, periodLabel };
}

const whatsappStatuses = {
  new: "Yeni sifarişiniz qəbul edildi.",
  confirmed: "Sifarişiniz təsdiqləndi.",
  preparing: "Sifarişiniz hazırlanır.",
  courier: "Sifarişiniz kuryerə verildi.",
  delivered: "Sifarişiniz çatdırıldı. Təşəkkür edirik!",
  cancelled: "Sifarişiniz ləğv edildi.",
};
const whatsappPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("994")) return digits;
  if (digits.startsWith("0")) return `994${digits.slice(1)}`;
  return digits.length <= 9 ? `994${digits}` : digits;
};
let notificationSchemaReady;
function ensureNotifications(e) {
  // DDL yalnız hər Worker isolate üçün bir dəfə işləyir; hər bildirişdə D1-i yükləmir.
  if (!notificationSchemaReady) {
    notificationSchemaReady = Promise.all([
      e.DB.prepare("CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL DEFAULT 'info', title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', data_json TEXT, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run(),
      e.DB.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner_user_id, is_read, created_at DESC)").run(),
    ]);
  }
  return notificationSchemaReady;
}
async function notification(e, ownerId, kind, title, body, data = null) {
  await ensureNotifications(e);
  return e.DB.prepare("INSERT INTO notifications(id,owner_user_id,kind,title,body,data_json) VALUES(?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), ownerId, kind, title, body, data ? JSON.stringify(data) : null)
    .run();
}
const whatsappMessage = (order, status) => {
  const statusText = whatsappStatuses[status] || "Sifarişiniz yeniləndi.";
  const productText = (order.cart || []).map((item) => `${item.name} × ${item.quantity}`).join(", ");
  return `Salam, ${order.customer?.name || "müştəri"}! ${statusText}\nSifariş: ${productText}`;
};
const whatsappUrl = (order, status) => `https://wa.me/${whatsappPhone(order.customer?.phone)}?text=${encodeURIComponent(whatsappMessage(order, status))}`;
async function sendWhatsAppStatus(e, order, status) {
  if (!e.WA_TOKEN || !e.WA_PHONE_NUMBER_ID || !e.WA_TEMPLATE_NAME) return false;
  const to = whatsappPhone(order.customer?.phone);
  if (!to) return false;
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${e.WA_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${e.WA_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: e.WA_TEMPLATE_NAME,
          language: { code: e.WA_TEMPLATE_LANGUAGE || "az" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: order.customer?.name || "Müştəri" },
                { type: "text", text: whatsappStatuses[status] || "Sifarişiniz yeniləndi." },
              ],
            },
          ],
        },
      }),
    },
  );
  return response.ok;
}

// --- AI Alış Köməkçisi: pulsuz web price monitor ---
let aiPurchaseSchemaReady;
function ensureAiPurchaseSchema(e) {
  if (!aiPurchaseSchemaReady) {
    aiPurchaseSchemaReady = (async () => {
      // D1 migration-ları ardıcıl işləyir: əvvəl cədvəllər, sonra indekslər.
      // Əvvəlki Promise.all yanaşması indeksin cədvəldən tez işləməsinə və 500 xətasına səbəb ola bilərdi.
      await e.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_price_watch (
        owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        country_key TEXT NOT NULL DEFAULT 'america',
        weight_grams REAL NOT NULL DEFAULT 0,
        current_total_azn REAL NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        threshold_pct REAL NOT NULL DEFAULT 8,
        last_scan_at TEXT,
        best_total_azn REAL,
        best_product_azn REAL,
        best_shipping_azn REAL,
        best_title TEXT,
        best_url TEXT,
        best_source TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(owner_user_id, product_id)
      )`).run();
      await e.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_price_offers (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT '',
        product_price_azn REAL NOT NULL,
        shipping_azn REAL NOT NULL DEFAULT 0,
        total_azn REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'AZN',
        raw_price REAL NOT NULL DEFAULT 0,
        found_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`).run();
      await e.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ai_watch_owner ON ai_price_watch(owner_user_id,enabled,updated_at)").run();
      await e.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ai_offer_product ON ai_price_offers(owner_user_id,product_id,total_azn,found_at DESC)").run();
      return true;
    })().catch((error) => {
      aiPurchaseSchemaReady = null;
      throw error;
    });
  }
  return aiPurchaseSchemaReady;
}
const defaultAiCountries = {
  america: { name: 'Amerika', currency: '$', rate: 1.7, tariffs: [3.49,5.49,7.49,9.77] },
  turkey: { name: 'Türkiyə', currency: '$', rate: 1.7, tariffs: [1.49,2.49,3.49,4.29] },
  spain: { name: 'İspaniya', currency: '€', rate: 1.96, tariffs: [1.75,3.7,5.6,7.9] },
};
function aiCountry(state, key) { return (state.countries && state.countries[key]) || defaultAiCountries[key] || defaultAiCountries.america; }
function aiShipping(weight, country) {
  const g = Math.max(0, Number(weight)||0), a = Array.isArray(country.tariffs) ? country.tariffs : [0,0,0,0];
  if (!g) return 0;
  if (g <= 100) return Number(a[0])||0;
  if (g <= 250) return Number(a[1])||0;
  if (g <= 500) return Number(a[2])||0;
  return Math.ceil(g/1000) * (Number(a[3])||0);
}
function aiCurrentUnitCost(item, state) {
  const c = aiCountry(state, item.country || 'america');
  return Math.round((((Number(item.price)||0) + aiShipping(item.weight, c)) * (Number(c.rate)||1)) * 100) / 100;
}
async function syncAiWatches(e, ownerId) {
  await ensureAiPurchaseSchema(e);
  const state = await readState(e, ownerId);
  const products = productList(state);
  for (const product of products) {
    const ownerOrder = (state.orders||[]).find((o) => String(o.id) === String(product.orderId));
    const item = ownerOrder?.items?.[product.index] || {};
    const productId = String(product.id);
    const countryKey = String(item.country || 'america');
    const weight = Number(item.weight)||0;
    const current = aiCurrentUnitCost(item, state);
    await e.DB.prepare(`INSERT INTO ai_price_watch(owner_user_id,product_id,product_name,country_key,weight_grams,current_total_azn)
      VALUES(?,?,?,?,?,?) ON CONFLICT(owner_user_id,product_id) DO UPDATE SET
      product_name=excluded.product_name,country_key=excluded.country_key,weight_grams=excluded.weight_grams,current_total_azn=excluded.current_total_azn,updated_at=CURRENT_TIMESTAMP`)
      .bind(ownerId, productId, String(product.name||'Məhsul').slice(0,220), countryKey, weight, current).run();
  }
  return state;
}
function decodeHtml(text='') {
  return String(text).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
function safeExternalUrl(raw) {
  try {
    const url = new URL(raw);
    if (!['http:','https:'].includes(url.protocol)) return null;
    const h = url.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return null;
    return url;
  } catch { return null; }
}
function ddgTarget(href) {
  try {
    const absolute = href.startsWith('//') ? `https:${href}` : href;
    const u = new URL(absolute, 'https://duckduckgo.com');
    const target = u.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : u.href;
  } catch { return ''; }
}
async function duckSearch(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 StockPilotPriceMonitor/1.0', 'accept-language':'en-US,en;q=0.8' } });
  if (!res.ok) return [];
  const html = await res.text();
  const results = [];
  const re = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && results.length < 8) {
    const href = ddgTarget(m[1]), u = safeExternalUrl(href);
    if (!u || u.hostname.includes('duckduckgo.com')) continue;
    results.push({ url:u.href, title:decodeHtml(m[2]), source:u.hostname.replace(/^www\./,'') });
  }
  return results;
}
async function bingSearch(query) {
  try {
    const url=`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-US`;
    const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 StockPilotPriceMonitor/1.0','accept-language':'en-US,en;q=0.8'}});
    if(!res.ok) return [];
    const html=await res.text();
    const out=[];
    const re=/<li[^>]+class=["'][^"']*b_algo[^"']*["'][\s\S]*?<h2>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while((m=re.exec(html))&&out.length<8){
      const u=safeExternalUrl(m[1]); if(!u||u.hostname.includes('bing.com')) continue;
      out.push({url:u.href,title:decodeHtml(m[2]),source:u.hostname.replace(/^www\./,'')});
    }
    return out;
  } catch { return []; }
}
function normalizeProductQuery(name='') {
  return String(name).replace(/[|]/g,' ').replace(/\s+/g,' ').trim();
}
async function multiPriceSearch(productName, countryName='') {
  const name=normalizeProductQuery(productName);
  const queries=[
    `${name} price buy`,
    `"${name}" shop price`,
    `${name} ${countryName} price`,
    `site:iherb.com ${name}`,
    `site:amazon.com ${name}`,
    `site:walmart.com ${name}`,
    `site:trendyol.com ${name}`,
  ];
  const merged=[];
  for(const q of queries.slice(0,5)){
    const [a,b]=await Promise.all([duckSearch(q),bingSearch(q)]);
    merged.push(...a,...b);
    if(merged.length>=18) break;
  }
  const seen=new Set();
  return merged.filter(r=>{
    try { const u=new URL(r.url); const key=`${u.hostname}${u.pathname}`.replace(/\/$/,''); if(seen.has(key))return false; seen.add(key); return true; }
    catch{return false}
  }).slice(0,18);
}
function priceCandidates(html) {
  const out=[];
  const push=(raw,currency='')=>{ const n=Number(String(raw).replace(/\s/g,'').replace(/,(?=\d{3}\b)/g,'').replace(',','.').replace(/[^0-9.]/g,'')); if(Number.isFinite(n)&&n>0&&n<100000) out.push({raw:n,currency}); };
  const metaPatterns=[
    /(?:product:price:amount|itemprop=["']price["'])[^>]*(?:content|value)=["']([0-9.,]+)["']/gi,
    /(?:content|value)=["']([0-9.,]+)["'][^>]*(?:product:price:amount|itemprop=["']price["'])/gi,
    /"price"\s*:\s*"?([0-9.,]+)"?/gi,
  ];
  for(const re of metaPatterns){let m; while((m=re.exec(html))&&out.length<20) push(m[1]);}
  const symbolPatterns=[[/\$\s*([0-9]+(?:[.,][0-9]{1,2})?)/g,'USD'],[/€\s*([0-9]+(?:[.,][0-9]{1,2})?)/g,'EUR'],[/([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:₼|AZN)\b/g,'AZN'],[/([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:₺|TRY)\b/g,'TRY']];
  for(const [re,c] of symbolPatterns){let m; while((m=re.exec(html))&&out.length<25) push(m[1],c);}
  return out;
}
function detectedCurrency(html, fallbackSymbol) {
  const m = html.match(/(?:priceCurrency|product:price:currency)[^A-Z]{0,20}(USD|EUR|AZN|TRY)/i);
  if (m) return m[1].toUpperCase();
  if (fallbackSymbol === '€') return 'EUR';
  if (fallbackSymbol === '₼') return 'AZN';
  if (fallbackSymbol === '₺') return 'TRY';
  return 'USD';
}
function currencyRateToAzn(code, state, fallbackCountry) {
  if (code === 'AZN') return 1;
  const countries = Object.values(state.countries || defaultAiCountries);
  if (code === 'EUR') { const x=countries.find(c=>c.currency==='€'); return Number(x?.rate)||1.96; }
  if (code === 'USD') { const x=countries.find(c=>c.currency==='$'); return Number(x?.rate)||1.7; }
  // TRY yalnız state-də ₺ tarifi varsa istifadə olunur; yoxdursa qeyri-dəqiq çevirmə etmə.
  if (code === 'TRY') { const x=countries.find(c=>c.currency==='₺' || c.currency==='TRY'); return Number(x?.rate)||0; }
  return Number(fallbackCountry?.rate)||0;
}
async function offerFromPage(result, state, watch) {
  const url=safeExternalUrl(result.url); if(!url) return null;
  try {
    const res=await fetch(url.href,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 StockPilotPriceMonitor/1.0','accept':'text/html,application/xhtml+xml'}});
    if(!res.ok) return null;
    const type=res.headers.get('content-type')||''; if(!type.includes('text/html')) return null;
    const html=(await res.text()).slice(0,900000);
    const country=aiCountry(state,watch.country_key);
    const candidates=priceCandidates(html);
    if(!candidates.length) return null;
    const fallbackCode=detectedCurrency(html,country.currency);
    const converted=[];
    for(const c of candidates){ const code=c.currency||fallbackCode; const rate=currencyRateToAzn(code,state,country); if(rate>0) converted.push({raw:c.raw,code,azn:c.raw*rate}); }
    if(!converted.length) return null;
    // məhsul səhifəsindəki çox kiçik kupon/faiz rəqəmlərini azaltmaq üçün cari qiymətin 15%-indən aşağı namizədləri at.
    const floor=Math.max(1,(Number(watch.current_total_azn)||0)*0.15);
    const plausible=converted.filter(x=>x.azn>=floor).sort((a,b)=>a.azn-b.azn);
    const pick=plausible[0]||converted.sort((a,b)=>a.azn-b.azn)[0];
    const shipping=Math.round(aiShipping(watch.weight_grams,country)*(Number(country.rate)||1)*100)/100;
    const product=Math.round(pick.azn*100)/100, total=Math.round((product+shipping)*100)/100;
    return { title:result.title||watch.product_name,url:url.href,source:result.source||url.hostname,productPriceAzn:product,shippingAzn:shipping,totalAzn:total,currency:pick.code,rawPrice:pick.raw };
  } catch { return null; }
}
async function scanAiProduct(e, ownerId, productId, {notify=true,sync=true}={}) {
  const state=sync ? await syncAiWatches(e,ownerId) : await readState(e,ownerId);
  const watch=await e.DB.prepare('SELECT * FROM ai_price_watch WHERE owner_user_id=? AND product_id=?').bind(ownerId,productId).first();
  if(!watch) return { error:'Məhsul izləmədə tapılmadı.' };
  const country=aiCountry(state,watch.country_key);
  const results=await multiPriceSearch(watch.product_name,country.name||'');
  const offers=[];
  for(const result of results.slice(0,9)){ const offer=await offerFromPage(result,state,watch); if(offer) offers.push(offer); }
  offers.sort((a,b)=>a.totalAzn-b.totalAzn);
  await e.DB.prepare('DELETE FROM ai_price_offers WHERE owner_user_id=? AND product_id=?').bind(ownerId,productId).run();
  for(const o of offers.slice(0,5)){ await e.DB.prepare(`INSERT INTO ai_price_offers(id,owner_user_id,product_id,title,url,source,product_price_azn,shipping_azn,total_azn,currency,raw_price) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),ownerId,productId,String(o.title).slice(0,300),String(o.url).slice(0,1500),String(o.source).slice(0,150),o.productPriceAzn,o.shippingAzn,o.totalAzn,o.currency,o.rawPrice).run(); }
  const oldBest=Number(watch.best_total_azn)||0, best=offers[0]||null, now=new Date().toISOString();
  if(best){
    await e.DB.prepare(`UPDATE ai_price_watch SET last_scan_at=?,best_total_azn=?,best_product_azn=?,best_shipping_azn=?,best_title=?,best_url=?,best_source=?,updated_at=CURRENT_TIMESTAMP WHERE owner_user_id=? AND product_id=?`).bind(now,best.totalAzn,best.productPriceAzn,best.shippingAzn,String(best.title).slice(0,300),String(best.url).slice(0,1500),String(best.source).slice(0,150),ownerId,productId).run();
    const current=Number(watch.current_total_azn)||0, threshold=Math.max(0,Number(watch.threshold_pct)||8);
    const savings=current>0?((current-best.totalAzn)/current)*100:0;
    const materiallyNew=!oldBest || best.totalAzn < oldBest-0.05;
    if(notify && materiallyNew && savings>=threshold){
      await notification(e,ownerId,'ai-price',`AI alış: ${watch.product_name}`,`${best.totalAzn.toFixed(2)} ₼ (karqo daxil) · ${savings.toFixed(1)}% qənaət`,{productId,bestUrl:best.url,totalAzn:best.totalAzn,savingsPct:Math.round(savings*10)/10});
    }
  } else {
    await e.DB.prepare('UPDATE ai_price_watch SET last_scan_at=?,updated_at=CURRENT_TIMESTAMP WHERE owner_user_id=? AND product_id=?').bind(now,ownerId,productId).run();
  }
  return { watch:{...watch,last_scan_at:now}, offers, best };
}
async function aiPurchasePayload(e,ownerId){
  const state=await syncAiWatches(e,ownerId);
  const rows=await e.DB.prepare('SELECT * FROM ai_price_watch WHERE owner_user_id=? ORDER BY enabled DESC, updated_at DESC').bind(ownerId).all();
  const watches=[];
  for(const w of rows.results||[]){
    const offerRows=await e.DB.prepare('SELECT title,url,source,product_price_azn,shipping_azn,total_azn,currency,raw_price,found_at FROM ai_price_offers WHERE owner_user_id=? AND product_id=? ORDER BY total_azn ASC LIMIT 5').bind(ownerId,w.product_id).all();
    watches.push({ productId:w.product_id,productName:w.product_name,countryKey:w.country_key,weightGrams:Number(w.weight_grams)||0,currentTotalAzn:Number(w.current_total_azn)||0,enabled:Boolean(w.enabled),thresholdPct:Number(w.threshold_pct)||0,lastScanAt:w.last_scan_at,bestTotalAzn:Number(w.best_total_azn)||0,bestProductAzn:Number(w.best_product_azn)||0,bestShippingAzn:Number(w.best_shipping_azn)||0,bestTitle:w.best_title||'',bestUrl:w.best_url||'',bestSource:w.best_source||'',offers:(offerRows.results||[]).map(o=>({title:o.title,url:o.url,source:o.source,productPriceAzn:Number(o.product_price_azn),shippingAzn:Number(o.shipping_azn),totalAzn:Number(o.total_azn),currency:o.currency,rawPrice:Number(o.raw_price),foundAt:o.found_at})) });
  }
  return { watches, countries:state.countries||defaultAiCountries };
}
async function scanAllAiWatches(e){
  await ensureAiPurchaseSchema(e);
  const rows=await e.DB.prepare("SELECT owner_user_id,product_id FROM ai_price_watch WHERE enabled=1 ORDER BY COALESCE(last_scan_at,'1970-01-01') ASC LIMIT 6").all();
  for(const row of rows.results||[]){ try{ await scanAiProduct(e,row.owner_user_id,row.product_id,{notify:true,sync:false}); }catch{} }
}

export default {
  async fetch(r, e) {
    const u = new URL(r.url),
      p = u.pathname;
    if (p.startsWith("/api/images/")) {
      if (!e.IMAGES) return new Response("Not found", { status: 404 });
      const o = await e.IMAGES.get(decodeURIComponent(p.slice(12)));
      return o
        ? new Response(o.body, {
            headers: {
              "content-type": o.httpMetadata?.contentType || "image/jpeg",
            },
          })
        : new Response("Not found", { status: 404 });
    }
    if (p === "/api/register" && r.method === "POST") {
      const f = await r.formData(),
        username = String(f.get("username") || "").trim(),
        first = String(f.get("firstName") || "").trim(),
        last = String(f.get("lastName") || "").trim(),
        password = String(f.get("password") || "");
      if (!/^[\w.-]{3,30}$/.test(username) || !first || !last)
        return fail("Bütün məlumatları düzgün yazın.");
      if (!/^\d{4}$/.test(password)) return fail("Şifrə 4 rəqəm olmalıdır.");
      if (
        await e.DB.prepare("SELECT id FROM users WHERE username=?")
          .bind(username)
          .first()
      )
        return fail("Username artıq istifadə olunur.", 409);
      const id = crypto.randomUUID(),
        salt = b64(crypto.getRandomValues(new Uint8Array(16)));
      let key = null,
        file = f.get("photo");
      if (file && typeof file !== "string" && file.size) {
        if (!e.IMAGES)
          return fail(
            "Profil şəkli hazırda aktiv deyil. Şəkilsiz qeydiyyatdan keçin.",
          );
        if (file.size > 4e6) return fail("Şəkil maksimum 4MB olmalıdır.");
        key = `profiles/${id}/${crypto.randomUUID()}`;
        await e.IMAGES.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });
      }
      await e.DB.prepare(
        "INSERT INTO users(id,username,first_name,last_name,password_hash,salt,photo_key) VALUES(?,?,?,?,?,?,?)",
      )
        .bind(id, username, first, last, await hash(password, salt), salt, key)
        .run();
      await e.DB.prepare(
        "INSERT INTO user_state(user_id,state_json) VALUES(?,?)",
      )
        .bind(id, '{"orders":[],"customerSales":[]}')
        .run();
      const user = {
        id,
        username,
        first_name: first,
        last_name: last,
        photo_key: key,
      };
      return json(
        { token: await issue(user, e.AUTH_SECRET), user: pub(user) },
        201,
      );
    }
    if (p === "/api/login" && r.method === "POST") {
      const { username, password } = await r.json(),
        user = await e.DB.prepare("SELECT * FROM users WHERE username=?")
          .bind(String(username || "").trim())
          .first();
      if (
        !user ||
        !/^\d{4}$/.test(password || "") ||
        (await hash(password, user.salt)) !== user.password_hash
      )
        return fail("Məlumatlar yanlışdır.", 401);
      return json({ token: await issue(user, e.AUTH_SECRET), user: pub(user) });
    }
    const storeMatch = p.match(/^\/api\/store\/([\w.-]{3,30})$/);
    if (storeMatch && r.method === "GET") {
      const owner = await e.DB.prepare("SELECT * FROM users WHERE username=?").bind(storeMatch[1]).first();
      if (!owner) return fail("Mağaza tapılmadı.", 404);
      const state = await readState(e, owner.id);
      const reserved = await reservedStock(e, owner.id);
      // Kataloq tam görünür; aktiv müştəri sifarişlərində rezerv olunan say mövcud stokdan çıxılır.
      const storeSettings = await readStoreSettings(e, owner.id);
      return json({ shop: { username: owner.username, name: `${owner.first_name} ${owner.last_name}`, originLabel: storeSettings.originLabel }, products: productList(state, reserved) });
    }
    const storeQuoteMatch = p.match(/^\/api\/store\/([\w.-]{3,30})\/delivery-quote$/);
    if (storeQuoteMatch && r.method === "POST") {
      const owner = await e.DB.prepare("SELECT id FROM users WHERE username=?").bind(storeQuoteMatch[1]).first();
      if (!owner) return fail("Mağaza tapılmadı.", 404);
      const body = await r.json();
      const lat = Number(body.lat), lng = Number(body.lng), preferredAt = String(body.preferredAt || "");
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return fail("Çatdırılma konumu düzgün deyil.");
      if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::\d{2})?$/.test(preferredAt)) return fail("Çatdırılma vaxtı düzgün deyil.");
      return json(await calculateDeliveryQuote(e, owner.id, lat, lng, preferredAt));
    }
    const storeTrackMatch = p.match(/^\/api\/store\/([\w.-]{3,30})\/orders\/([0-9a-fA-F-]{36})$/);
    if (storeTrackMatch && r.method === "GET") {
      const owner = await e.DB.prepare("SELECT id FROM users WHERE username=?").bind(storeTrackMatch[1]).first();
      if (!owner) return fail("Mağaza tapılmadı.", 404);
      const row = await e.DB.prepare("SELECT order_json,status FROM customer_orders WHERE id=? AND owner_user_id=?").bind(storeTrackMatch[2], owner.id).first();
      if (!row) return fail("Sifariş tapılmadı.", 404);
      let order;
      try { order = JSON.parse(row.order_json); } catch { return fail("Sifariş məlumatı oxunmadı.", 500); }
      return json({
        id: order.id,
        status: row.status,
        createdAt: order.createdAt,
        preferredAt: order.customer?.preferredAt || "",
        delivery: order.customer?.delivery || "",
        subtotal: Number(order.subtotal ?? order.total) || 0,
        deliveryFee: Number(order.deliveryFee) || 0,
        deliveryDistanceKm: Number(order.deliveryDistanceKm) || 0,
        total: Number(order.total) || 0,
        cart: (order.cart || []).map((item) => ({
          id: item.id,
          name: item.name,
          image: item.image || "",
          price: Number(item.price) || 0,
          quantity: Math.max(1, Number(item.quantity) || 1),
        })),
      });
    }
    const storeOrderMatch = p.match(/^\/api\/store\/([\w.-]{3,30})\/orders$/);
    if (storeOrderMatch && r.method === "POST") {
      const owner = await e.DB.prepare("SELECT * FROM users WHERE username=?").bind(storeOrderMatch[1]).first();
      if (!owner) return fail("Mağaza tapılmadı.", 404);
      const body = await r.json();
      const name = String(body.name || "").trim(), phone = String(body.phone || "").trim();
      if (!name || !phone || !Array.isArray(body.cart) || !body.cart.length) return fail("Ad, telefon və məhsullar tələb olunur.");
      const products = productList(await readState(e, owner.id));
      const cart = [];
      for (const line of body.cart) {
        const product = products.find((x) => String(x.id) === String(line.id));
        const quantity = Math.max(1, Number(line.quantity) || 1);
        if (!product) return fail("Məhsul tapılmadı.", 404);
        cart.push({ ...product, quantity });
      }
      const preferredAt = String(body.preferredAt || "").slice(0, 40);
      if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::\d{2})?$/.test(preferredAt)) return fail("Çatdırılma tarix və saatını 24 saat formatında yazın.");
      if (preferredAt.slice(0, 10) < new Date().toISOString().slice(0, 10)) return fail("Keçmiş tarix seçilə bilməz.");
      const delivery = String(body.delivery || "metro");
      let deliveryFee = 0, deliveryDistanceKm = 0, deliveryPeriodLabel = "";
      let deliveryLat = null, deliveryLng = null;
      if (delivery === "address") {
        deliveryLat = Number(body.deliveryLat); deliveryLng = Number(body.deliveryLng);
        if (!Number.isFinite(deliveryLat) || deliveryLat < -90 || deliveryLat > 90 || !Number.isFinite(deliveryLng) || deliveryLng < -180 || deliveryLng > 180) return fail("Çatdırılma konumunu xəritədən seçin.");
        const quote = await calculateDeliveryQuote(e, owner.id, deliveryLat, deliveryLng, preferredAt);
        deliveryFee = quote.fee; deliveryDistanceKm = quote.distanceKm; deliveryPeriodLabel = quote.periodLabel;
      }
      const subtotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
      const order = { id: crypto.randomUUID(), customer: { name, phone, note: String(body.note || "").slice(0, 500), delivery, metro: String(body.metro || ""), address: String(body.address || ""), payment: String(body.payment || "cash"), preferredAt, deliveryLat, deliveryLng }, cart, subtotal, deliveryFee, deliveryDistanceKm, deliveryPeriodLabel, total: subtotal + deliveryFee, createdAt: new Date().toISOString() };
      await e.DB.prepare("INSERT INTO customer_orders(id,owner_user_id,order_json,status) VALUES(?,?,?,?)").bind(order.id, owner.id, JSON.stringify(order), "new").run();
      await notification(e, owner.id, "customer-order", "Yeni müştəri sifarişi", `${name} · ${order.total.toFixed(2)} ₼`, { orderId: order.id });
      return json({ ok: true, orderId: order.id }, 201);
    }
    const user = await who(r, e);
    if (p === "/api/ai-purchases" && r.method === "GET") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      return json(await aiPurchasePayload(e,user.id));
    }
    if (p === "/api/ai-purchases/scan-all" && r.method === "POST") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      const payload=await aiPurchasePayload(e,user.id);
      const enabled=payload.watches.filter(w=>w.enabled).slice(0,5);
      const results=[];
      for(const w of enabled){ try{ results.push(await scanAiProduct(e,user.id,w.productId,{notify:true,sync:false})); }catch(err){ results.push({productId:w.productId,error:String(err?.message||err)}); } }
      return json({ok:true,scanned:results.length});
    }
    const aiScanMatch=p.match(/^\/api\/ai-purchases\/([^/]+)\/scan$/);
    if(aiScanMatch && r.method === "POST") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      return json(await scanAiProduct(e,user.id,decodeURIComponent(aiScanMatch[1]),{notify:true}));
    }
    const aiWatchMatch=p.match(/^\/api\/ai-purchases\/([^/]+)$/);
    if(aiWatchMatch && r.method === "PUT") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      await ensureAiPurchaseSchema(e);
      const id=decodeURIComponent(aiWatchMatch[1]), body=await r.json();
      const enabled=body.enabled===undefined?1:(body.enabled?1:0);
      const threshold=clampNum(body.thresholdPct,0,90,8);
      const result=await e.DB.prepare('UPDATE ai_price_watch SET enabled=?,threshold_pct=?,updated_at=CURRENT_TIMESTAMP WHERE owner_user_id=? AND product_id=?').bind(enabled,threshold,user.id,id).run();
      if(!result.meta.changes) return fail('Məhsul izləmədə tapılmadı.',404);
      return json({ok:true});
    }
    if (p === "/api/me")
      return user
        ? json({ user: pub(user) })
        : fail("Giriş tələb olunur.", 401);
    if (p === "/api/store-settings") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      if (r.method === "GET") return json({ settings: await readStoreSettings(e, user.id) });
      if (r.method === "PUT") {
        const body = await r.json();
        const current = await readStoreSettings(e, user.id);
        const next = {
          originLat: clampNum(body.originLat, -90, 90, current.originLat),
          originLng: clampNum(body.originLng, -180, 180, current.originLng),
          originLabel: String(body.originLabel || current.originLabel || "Mağaza").trim().slice(0,120),
          baseFee: clampNum(body.baseFee, 0, 100, current.baseFee), perKm: clampNum(body.perKm, 0, 20, current.perKm), minFee: clampNum(body.minFee, 5, 100, Math.max(5, current.minFee)),
          morningMultiplier: clampNum(body.morningMultiplier, 0.5, 3, current.morningMultiplier), eveningMultiplier: clampNum(body.eveningMultiplier, 0.5, 3, current.eveningMultiplier),
          nightMultiplier: clampNum(body.nightMultiplier, 0.5, 3, current.nightMultiplier), weekendMultiplier: clampNum(body.weekendMultiplier, 0.5, 3, current.weekendMultiplier),
        };
        await ensureStoreSettings(e);
        await e.DB.prepare(`INSERT INTO store_settings(owner_user_id,origin_lat,origin_lng,origin_label,base_fee,per_km,min_fee,morning_multiplier,evening_multiplier,night_multiplier,weekend_multiplier,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(owner_user_id) DO UPDATE SET origin_lat=excluded.origin_lat,origin_lng=excluded.origin_lng,origin_label=excluded.origin_label,base_fee=excluded.base_fee,per_km=excluded.per_km,min_fee=excluded.min_fee,morning_multiplier=excluded.morning_multiplier,evening_multiplier=excluded.evening_multiplier,night_multiplier=excluded.night_multiplier,weekend_multiplier=excluded.weekend_multiplier,updated_at=CURRENT_TIMESTAMP`).bind(user.id,next.originLat,next.originLng,next.originLabel,next.baseFee,next.perKm,next.minFee,next.morningMultiplier,next.eveningMultiplier,next.nightMultiplier,next.weekendMultiplier).run();
        return json({ ok:true, settings: next });
      }
    }
    if (p === "/api/profile" && r.method === "PUT") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      const body = await r.json();
      const first = String(body.firstName || "").trim();
      const last = String(body.lastName || "").trim();
      const username = String(body.username || "").trim();
      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");
      if (!first || !last || !/^[\w.-]{3,30}$/.test(username))
        return fail("Ad, soyad və username düzgün yazılmalıdır.");
      const other = await e.DB.prepare(
        "SELECT id FROM users WHERE username=? AND id<>?",
      )
        .bind(username, user.id)
        .first();
      if (other) return fail("Bu username artıq istifadə olunur.", 409);
      let passwordHash = user.password_hash;
      if (newPassword) {
        if (!/^\d{4}$/.test(newPassword))
          return fail("Yeni şifrə 4 rəqəm olmalıdır.");
        if ((await hash(currentPassword, user.salt)) !== user.password_hash)
          return fail("Hazırkı şifrə yanlışdır.", 401);
        passwordHash = await hash(newPassword, user.salt);
      }
      await e.DB.prepare(
        "UPDATE users SET username=?,first_name=?,last_name=?,password_hash=? WHERE id=?",
      )
        .bind(username, first, last, passwordHash, user.id)
        .run();
      const updated = {
        ...user,
        username,
        first_name: first,
        last_name: last,
        password_hash: passwordHash,
      };
      return json({ token: await issue(updated, e.AUTH_SECRET), user: pub(updated) });
    }
    if (p === "/api/state") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      if (r.method === "GET") return json({ state: await readState(e, user.id) });
      if (r.method === "PUT") {
        let body;
        try { body = await r.json(); } catch { return fail("JSON düzgün deyil."); }
        const state = body?.state;
        const validationError = validateState(state);
        if (validationError) return fail(validationError);
        await e.DB.prepare(
          "INSERT INTO user_state(user_id,state_json,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET state_json=excluded.state_json,updated_at=CURRENT_TIMESTAMP",
        )
          .bind(user.id, JSON.stringify(state))
          .run();
        return json({ ok: true });
      }
    }
    if (p === "/api/customer-orders" && r.method === "GET") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      const rows = await e.DB.prepare("SELECT id,order_json,status,created_at,updated_at FROM customer_orders WHERE owner_user_id=? ORDER BY created_at DESC").bind(user.id).all();
      return json({ orders: (rows.results || []).map((row) => ({ ...JSON.parse(row.order_json), status: row.status, createdAt: row.created_at, updatedAt: row.updated_at })) });
    }
    if (p === "/api/notifications" && r.method === "GET") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      await ensureNotifications(e);
      const rows = await e.DB.prepare("SELECT id,kind,title,body,data_json,is_read,created_at FROM notifications WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
      return json({ notifications: (rows.results || []).map((row) => ({ id: row.id, kind: row.kind, title: row.title, body: row.body, data: row.data_json ? JSON.parse(row.data_json) : null, read: Boolean(row.is_read), createdAt: row.created_at })) });
    }
    if (p === "/api/notifications" && r.method === "POST") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      const body = await r.json();
      const username = String(body.username || "").trim();
      const title = String(body.title || "Bildiriş").trim().slice(0, 100);
      const message = String(body.message || "").trim().slice(0, 500);
      if (!username || !message) return fail("Username və bildiriş mətni tələb olunur.");
      const recipient = await e.DB.prepare("SELECT id FROM users WHERE username=?").bind(username).first();
      if (!recipient) return fail("Bu username ilə istifadəçi tapılmadı.", 404);
      await notification(e, recipient.id, "message", title, message, { from: user.username });
      return json({ ok: true });
    }
    if (p === "/api/notifications/read-all" && r.method === "POST") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      await ensureNotifications(e);
      await e.DB.prepare("UPDATE notifications SET is_read=1 WHERE owner_user_id=?").bind(user.id).run();
      return json({ ok: true });
    }
    const notificationMatch = p.match(/^\/api\/notifications\/([\w-]+)\/read$/);
    if (notificationMatch && r.method === "POST") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      await ensureNotifications(e);
      await e.DB.prepare("UPDATE notifications SET is_read=1 WHERE id=? AND owner_user_id=?").bind(notificationMatch[1], user.id).run();
      return json({ ok: true });
    }
    const customerMatch = p.match(/^\/api\/customer-orders\/([\w-]+)$/);
    if (customerMatch && r.method === "DELETE") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      const result = await e.DB.prepare(
        "DELETE FROM customer_orders WHERE id=? AND owner_user_id=?",
      )
        .bind(customerMatch[1], user.id)
        .run();
      if (!result.meta.changes) return fail("Sifariş tapılmadı.", 404);
      return json({ ok: true });
    }
    if (customerMatch && r.method === "PUT") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      const body = await r.json();
      const status = String(body.status || "new");
      if (!['new','confirmed','preparing','courier','delivered','cancelled'].includes(status)) return fail("Status düzgün deyil.");
      const row = await e.DB.prepare("SELECT order_json,status FROM customer_orders WHERE id=? AND owner_user_id=?").bind(customerMatch[1], user.id).first();
      if (!row) return fail("Sifariş tapılmadı.", 404);
      const order = JSON.parse(row.order_json);
      if (body.customer && typeof body.customer === "object") {
        const next = body.customer;
        order.customer = {
          ...order.customer,
          name: String(next.name ?? order.customer.name ?? "").trim().slice(0, 100),
          phone: String(next.phone ?? order.customer.phone ?? "").trim().slice(0, 50),
          note: String(next.note ?? order.customer.note ?? "").trim().slice(0, 500),
          delivery: String(next.delivery ?? order.customer.delivery ?? "metro").slice(0, 30),
          metro: String(next.metro ?? order.customer.metro ?? "").trim().slice(0, 100),
          address: String(next.address ?? order.customer.address ?? "").trim().slice(0, 300),
          payment: String(next.payment ?? order.customer.payment ?? "cash").slice(0, 30),
          preferredAt: String(next.preferredAt ?? order.customer.preferredAt ?? "").slice(0, 40),
        };
        if (!order.customer.name || !order.customer.phone)
          return fail("Müştərinin adı və telefonu tələb olunur.");
      }
      if (status === 'delivered' && row.status !== 'delivered') {
        const state = await readState(e, user.id);
        state.customerSales = Array.isArray(state.customerSales) ? state.customerSales : [];
        for (const line of order.cart || []) {
          for (const ownerOrder of state.orders || []) for (let i = 0; i < (ownerOrder.items || []).length; i++) {
            const item = ownerOrder.items[i], itemId = item.id || `${ownerOrder.id}:${i}`;
            if (String(itemId) === String(line.id)) {
              const deliveredQty = Math.max(0, Number(line.quantity) || 0);
              if (!deliveredQty) continue;
              item.acquiredQty = Number(item.acquiredQty ?? item.qty) || 0;
              item.qty = Math.max(0, (Number(item.qty) || 0) - deliveredQty);
              state.customerSales.push({
                id: crypto.randomUUID(), customerOrderId: customerMatch[1], orderId: ownerOrder.id,
                itemId, name: item.name || line.name || "Məhsul", quantity: deliveredQty, sales: (Number(item.sale) || 0) * deliveredQty,
                purchase: ((Number(item.price) || 0) * deliveredQty) * (item.country === "spain" ? 1.96 : 1.7),
                soldAt: new Date().toISOString(),
              });
            }
          }
        }
        await e.DB.prepare("UPDATE user_state SET state_json=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(JSON.stringify(state), user.id).run();
      }
      await e.DB.prepare("UPDATE customer_orders SET order_json=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_user_id=?").bind(JSON.stringify(order), status, customerMatch[1], user.id).run();
      const messageSent = status !== row.status ? await sendWhatsAppStatus(e, order, status).catch(() => false) : false;
      if (status !== row.status) await notification(e, user.id, "order-status", `Sifariş statusu: ${whatsappStatuses[status] || status}`, `${order.customer?.name || "Müştəri"} · ${order.total?.toFixed?.(2) || order.total || 0} ₼`, { orderId: customerMatch[1], status });
      return json({ ok: true, messageSent, whatsappUrl: whatsappUrl(order, status), order: { ...order, status } });
    }
    return e.ASSETS.fetch(r);
  },
  async scheduled(event, e, ctx) {
    ctx.waitUntil(scanAllAiWatches(e));
  },
};
