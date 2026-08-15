const enc = new TextEncoder();
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "geolocation=(self), camera=(), microphone=(), payment=()",
  "cross-origin-opener-policy": "same-origin",
};
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://unpkg.com https://cdn.sheetjs.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org https://api.qrserver.com",
  "connect-src 'self' https://router.project-osrm.org",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');
const applySecurityHeaders = (headers, { html = false } = {}) => {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  if (html) headers.set("content-security-policy", CSP);
  return headers;
};
const json = (x, status = 200, extraHeaders = {}) => {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  applySecurityHeaders(headers);
  return new Response(JSON.stringify(x), { status, headers });
};
const fail = (message, status = 400, extra = {}) => json({ error: message, ...extra }, status);
const b64 = (x) => btoa(String.fromCharCode(...new Uint8Array(x)));
const from64 = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
const b64urlText = (text) => btoa(unescape(encodeURIComponent(text))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const fromB64urlText = (text) => decodeURIComponent(escape(atob(String(text).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '='))));
const b64urlBytes = (bytes) => b64(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const constantTimeEqual = (a, b) => {
  const aa = enc.encode(String(a || '')), bb = enc.encode(String(b || ''));
  let diff = aa.length ^ bb.length;
  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
};
const PASSWORD_ITERATIONS = 210000;
const LEGACY_PASSWORD_ITERATIONS = 100000;
function normalizeBase64(value) {
  const text = String(value || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  return text.padEnd(Math.ceil(text.length / 4) * 4, '=');
}
function decodeBase64(value) {
  const normalized = normalizeBase64(value);
  return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
}
async function deriveHash(password, salt, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: decodeBase64(salt), iterations, hash: "SHA-256" }, key, 256));
}
async function hashPassword(password, salt, iterations = PASSWORD_ITERATIONS) {
  // v41 stores the raw PBKDF2 output and keeps the iteration count in its own DB column.
  // This avoids shell/SQL quoting problems around `$` while remaining backward-compatible.
  return deriveHash(password, salt, iterations);
}
function passwordHashInfo(stored, iterationsHint) {
  const value = String(stored || '').trim();
  const prefixed = value.match(/^pbkdf2\$(\d+)\$([A-Za-z0-9+/_=-]+)$/);
  if (prefixed) {
    const iterations = Math.min(600000, Math.max(50000, Number(prefixed[1]) || PASSWORD_ITERATIONS));
    return { kind: 'prefixed', value: normalizeBase64(prefixed[2]), candidates: [iterations] };
  }
  if (/^[A-Za-z0-9+/_-]{43}=?$/.test(value) || /^[A-Za-z0-9+/_-]{44}$/.test(value)) {
    const hint = Number(iterationsHint);
    const candidates = [];
    if (Number.isFinite(hint) && hint >= 50000 && hint <= 600000) candidates.push(hint);
    for (const n of [PASSWORD_ITERATIONS, LEGACY_PASSWORD_ITERATIONS]) if (!candidates.includes(n)) candidates.push(n);
    return { kind: 'raw', value: normalizeBase64(value), candidates };
  }
  if (/^\d{4}$/.test(value)) return { kind: 'literal', value, candidates: [] };
  return { kind: 'unknown', value, candidates: [] };
}
async function verifyPassword(password, salt, stored, iterationsHint) {
  const info = passwordHashInfo(stored, iterationsHint);
  if (info.kind === 'literal') return { ok: constantTimeEqual(String(password), info.value), iterations: 0, kind: info.kind };
  if (info.kind === 'unknown') return { ok: false, iterations: 0, kind: info.kind };
  try {
    for (const iterations of info.candidates) {
      const derived = normalizeBase64(await deriveHash(password, salt, iterations));
      if (constantTimeEqual(derived, info.value)) return { ok: true, iterations, kind: info.kind };
    }
  } catch (error) {
    console.warn('password verification failed to derive', { kind: info.kind, saltLength: String(salt || '').length });
  }
  return { ok: false, iterations: 0, kind: info.kind };
}
async function mac(x, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64urlBytes(await crypto.subtle.sign("HMAC", key, enc.encode(x)));
}
async function issue(user, secret) {
  const header = b64urlText(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64urlText(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 604800, iat: Math.floor(Date.now() / 1000) }));
  return `${header}.${payload}.${await mac(`${header}.${payload}`, secret)}`;
}
const sessionCookie = (token) => `sp_session=${encodeURIComponent(token)}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Strict`;
const clearSessionCookie = () => `sp_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
function cookieValue(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}
async function verifyToken(token, secret) {
  try {
    const [h, p, signature] = String(token || '').split('.');
    if (!h || !p || !signature) return null;
    const expected = await mac(`${h}.${p}`, secret);
    // New base64url signature.
    let signatureOk = constantTimeEqual(signature, expected);
    // Legacy base64 signature compatibility, only during migration.
    if (!signatureOk) {
      const legacyKey = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const legacy = b64(await crypto.subtle.sign("HMAC", legacyKey, enc.encode(`${h}.${p}`)));
      signatureOk = constantTimeEqual(signature, legacy);
    }
    if (!signatureOk) return null;
    let payload;
    try { payload = JSON.parse(fromB64urlText(p)); } catch { payload = JSON.parse(atob(p)); }
    const exp = Number(payload?.exp);
    const expiryMs = exp > 10_000_000_000 ? exp : exp * 1000;
    if (!payload?.sub || !Number.isFinite(exp) || expiryMs < Date.now()) return null;
    return payload;
  } catch { return null; }
}
async function who(request, env) {
  if (!env.AUTH_SECRET) return null;
  const auth = request.headers.get("authorization") || "";
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1] || '';
  const token = cookieValue(request, 'sp_session') || bearer;
  const payload = await verifyToken(token, env.AUTH_SECRET);
  if (!payload) return null;
  return env.DB.prepare("SELECT * FROM users WHERE id=?").bind(payload.sub).first();
}
async function safeJson(request, maxBytes = 100000) {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  try { return JSON.parse(text || '{}'); } catch { throw new Error('BAD_JSON'); }
}
const unsafeMethod = (method) => !['GET', 'HEAD', 'OPTIONS'].includes(method);
function validRequestOrigin(request) {
  if (!unsafeMethod(request.method)) return true;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return origin === new URL(request.url).origin; } catch { return false; }
}
const safeLegacyPhoto = (value) => {
  const text = String(value || "");
  return /^data:image\/(?:png|jpeg|webp);base64,/i.test(text) && text.length <= 2_500_000 ? text : null;
};
const pub = (u) => ({
  id: u.id,
  username: u.username,
  firstName: u.first_name,
  lastName: u.last_name,
  photo: u.photo_key ? `/api/images/${u.photo_key}` : safeLegacyPhoto(u.photo_text),
});

let authSchemaReady;
async function tableColumns(e, table) {
  const result = await e.DB.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((result.results || []).map((row) => String(row.name || "")));
}
async function userColumns(e) { return tableColumns(e, 'users'); }
function ensureAuthSchema(e) {
  if (!authSchemaReady) {
    authSchemaReady = (async () => {
      await e.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        password_iterations INTEGER NOT NULL DEFAULT 210000,
        photo_key TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`).run();

      // Incrementally migrate existing databases. Never drop/recreate `users`, so all old data stays intact.
      let columns = await userColumns(e);
      if (!columns.has("photo_key")) {
        try { await e.DB.prepare("ALTER TABLE users ADD COLUMN photo_key TEXT").run(); } catch (error) {
          console.warn('auth migration photo_key', String(error?.message || error));
        }
      }
      columns = await userColumns(e);
      if (!columns.has("created_at")) {
        try {
          await e.DB.prepare("ALTER TABLE users ADD COLUMN created_at TEXT").run();
          await e.DB.prepare("UPDATE users SET created_at=CURRENT_TIMESTAMP WHERE created_at IS NULL OR created_at='' ").run();
        } catch (error) { console.warn('auth migration created_at', String(error?.message || error)); }
      }
      columns = await userColumns(e);
      if (!columns.has("password_iterations")) {
        // Legacy StockPilot hashes were PBKDF2-SHA256/100k unless the hash carries its own pbkdf2$N$ prefix.
        try { await e.DB.prepare("ALTER TABLE users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 100000").run(); }
        catch (error) { console.warn('auth migration password_iterations', String(error?.message || error)); }
      }

      await e.DB.prepare(`CREATE TABLE IF NOT EXISTS user_state (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`).run();
      let stateColumns = await tableColumns(e, 'user_state');
      if (!stateColumns.has('updated_at')) {
        try {
          await e.DB.prepare("ALTER TABLE user_state ADD COLUMN updated_at TEXT").run();
          await e.DB.prepare("UPDATE user_state SET updated_at=CURRENT_TIMESTAMP WHERE updated_at IS NULL OR updated_at='' ").run();
        } catch (error) { console.warn('auth migration user_state.updated_at', String(error?.message || error)); }
      }

      // Case-insensitive lookup index for legacy tables created without COLLATE NOCASE.
      try { await e.DB.prepare("CREATE INDEX IF NOT EXISTS idx_users_username_nocase ON users(username COLLATE NOCASE)").run(); } catch (error) {
        console.warn('auth migration username index', String(error?.message || error));
      }
      return true;
    })().catch((error) => { authSchemaReady = null; throw error; });
  }
  return authSchemaReady;
}
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
  if (!validateStateTree(state)) return "Məlumat daxilində icazə verilməyən və ya həddən artıq böyük dəyər var.";
  const encoded = JSON.stringify(state);
  if (encoded.length > 8_000_000) return "Məlumat ölçüsü çox böyükdür.";
  return null;
};
const safeImageValue = (value) => {
  const src = String(value || "").trim();
  if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(src) && src.length <= 2_500_000) return src;
  if (/^\/api\/images\/[A-Za-z0-9_./%-]+$/.test(src) && !src.includes("..")) return src;
  return "";
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
        image: safeImageValue(item.img || item.image || ""),
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
  if (!notificationSchemaReady) {
    notificationSchemaReady = (async () => {
      await e.DB.prepare("CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL DEFAULT 'info', title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', data_json TEXT, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
      await e.DB.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner_user_id, is_read, created_at DESC)").run();
      return true;
    })().catch((error) => { notificationSchemaReady = null; throw error; });
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
function productTokens(name='') {
  return normalizeProductQuery(name).toLowerCase().replace(/[^a-z0-9çğıöşü\s.-]/g,' ').split(/\s+/).filter(t=>t.length>=3 && !['the','and','for','with','gram','grams','powder'].includes(t));
}
function expectedWeight(name='', fallback=0) {
  const m=String(name).match(/(?:^|\s)(\d{2,5})\s*(?:g|gr|gram|grams)\b/i);
  return m ? Number(m[1]) : Number(fallback)||0;
}
function trustedSourceScore(host='') {
  const h=String(host).toLowerCase().replace(/^www\./,'');
  const preferred=[
    ['optimumnutrition.com',100],['iherb.com',96],['amazon.com',94],['amazon.de',93],['amazon.co.uk',93],
    ['walmart.com',90],['vitacost.com',88],['bodybuilding.com',86],['gnc.com',86],['trendyol.com',82],['hepsiburada.com',80]
  ];
  for(const [domain,score] of preferred) if(h===domain||h.endsWith('.'+domain)) return score;
  return 45;
}
function brandOfficialQuery(name='') {
  const lower=String(name).toLowerCase();
  if(lower.includes('optimum nutrition')) return `site:optimumnutrition.com ${name}`;
  if(lower.includes('muscletech')) return `site:muscletech.com ${name}`;
  if(lower.includes('dymatize')) return `site:dymatize.com ${name}`;
  if(lower.includes('now foods')) return `site:nowfoods.com ${name}`;
  return '';
}
async function multiPriceSearch(productName, countryName='') {
  const name=normalizeProductQuery(productName);
  const official=brandOfficialQuery(name);
  const queries=[
    official,
    `site:iherb.com "${name}"`,
    `site:amazon.com "${name}"`,
    `"${name}" ${countryName} buy price`,
    `"${name}" price`,
  ].filter(Boolean).slice(0,5);
  const merged=[];
  for(const q of queries){
    const [a,b]=await Promise.all([duckSearch(q),bingSearch(q)]);
    merged.push(...a,...b);
    if(merged.length>=40) break;
  }
  const seen=new Set();
  return merged.filter(r=>{
    try {
      const u=approvedSellerUrl(r.url); if(!u) return false; const key=`${u.hostname}${u.pathname}`.replace(/\/$/,'');
      if(seen.has(key)) return false; seen.add(key);
      r.url=u.href; r.source=u.hostname.replace(/^www\./,'');
      return true;
    } catch{return false}
  }).sort((a,b)=>trustedSourceScore(b.source)-trustedSourceScore(a.source)).slice(0,26);
}
function pushPrice(out, raw, currency='', confidence=1, kind='structured') {
  const cleaned=String(raw).trim().replace(/\s/g,'').replace(/,(?=\d{3}\b)/g,'').replace(',','.').replace(/[^0-9.]/g,'');
  const n=Number(cleaned);
  if(Number.isFinite(n)&&n>0&&n<100000) out.push({raw:n,currency:String(currency||'').toUpperCase(),confidence,kind});
}
function structuredPriceCandidates(html, host='') {
  const out=[];
  // JSON-LD Product/Offer qiymətləri: ən etibarlı mənbə.
  const scripts=[...String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].slice(0,20);
  for(const m of scripts){
    try {
      const data=JSON.parse(m[1].trim());
      const nodes=Array.isArray(data)?data:[data];
      const walk=(node)=>{
        if(!node||typeof node!=='object') return;
        const type=String(node['@type']||'').toLowerCase();
        if(type.includes('offer')||type.includes('product')){
          if(node.price!==undefined) pushPrice(out,node.price,node.priceCurrency||'',1,'jsonld');
          if(node.lowPrice!==undefined) pushPrice(out,node.lowPrice,node.priceCurrency||'',.96,'jsonld-low');
          if(node.offers) walk(node.offers);
        }
        for(const v of Object.values(node)) if(v&&typeof v==='object') Array.isArray(v)?v.forEach(walk):walk(v);
      };
      nodes.forEach(walk);
    } catch{}
  }
  const metaPatterns=[
    /<meta[^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]+content=["']([0-9.,]+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([0-9.,]+)["'][^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]*>/gi,
  ];
  for(const re of metaPatterns){let m;while((m=re.exec(html))&&out.length<30) pushPrice(out,m[1],'',.92,'meta');}
  const h=String(host).toLowerCase();
  if(h.includes('amazon.')){
    let m;
    const re=/<span[^>]+class=["'][^"']*a-price-whole[^"']*["'][^>]*>([0-9.,]+)<\/span>[\s\S]{0,180}?<span[^>]+class=["'][^"']*a-price-fraction[^"']*["'][^>]*>([0-9]{2})<\/span>/gi;
    while((m=re.exec(html))&&out.length<30) pushPrice(out,`${m[1]}.${m[2]}`,'USD',.9,'amazon-main');
  }
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
  if (code === 'TRY') { const x=countries.find(c=>c.currency==='₺' || c.currency==='TRY'); return Number(x?.rate)||0; }
  return Number(fallbackCountry?.rate)||0;
}
function pageProductMatch(html, watch, resultTitle='') {
  const text=decodeHtml(`${resultTitle} ${(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||''} ${(String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||''}`).toLowerCase();
  const tokens=productTokens(watch.product_name);
  if(!tokens.length) return {ok:true,score:1};
  const hit=tokens.filter(t=>text.includes(t)).length;
  let score=hit/tokens.length;
  const want=expectedWeight(watch.product_name,watch.weight_grams);
  if(want){
    const weights=[...text.matchAll(/(\d{2,5})\s*(?:g|gr|gram|grams)\b/gi)].map(m=>Number(m[1]));
    if(weights.length){
      const close=weights.some(w=>Math.abs(w-want)<=Math.max(10,want*.08));
      if(close) score+=.25; else score-=.35;
    }
  }
  return {ok:score>=.55,score};
}
async function offerFromPage(result, state, watch) {
  const url=approvedSellerUrl(result.url); if(!url) return null;
  try {
    const res=await fetch(url.href,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (compatible; StockPilotPriceVerifier/2.0)','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.8'}});
    if(!res.ok) return null;
    const type=res.headers.get('content-type')||''; if(!type.includes('text/html')) return null;
    const html=(await res.text()).slice(0,1200000);
    const match=pageProductMatch(html,watch,result.title||'');
    if(!match.ok) return null;
    const country=aiCountry(state,watch.country_key);
    const candidates=structuredPriceCandidates(html,url.hostname);
    if(!candidates.length) return null;
    const fallbackCode=detectedCurrency(html,country.currency);
    const converted=[];
    for(const c of candidates){
      const code=c.currency||fallbackCode; const rate=currencyRateToAzn(code,state,country);
      if(rate>0) converted.push({...c,code,azn:c.raw*rate});
    }
    if(!converted.length) return null;
    // Main offer qiymətini seç: structured confidence + məntiqli qiymət aralığı.
    const current=Number(watch.current_total_azn)||0;
    const lower=current>0 ? Math.max(3,current*.28) : 3;
    const upper=current>0 ? Math.max(150,current*3.5) : 500;
    const plausible=converted.filter(x=>x.azn>=lower&&x.azn<=upper).sort((a,b)=>b.confidence-a.confidence || a.azn-b.azn);
    if(!plausible.length) return null;
    const pick=plausible[0];
    const shipping=Math.round(aiShipping(watch.weight_grams,country)*(Number(country.rate)||1)*100)/100;
    const product=Math.round(pick.azn*100)/100, total=Math.round((product+shipping)*100)/100;
    return {
      title:result.title||watch.product_name,url:url.href,source:result.source||url.hostname,
      productPriceAzn:product,shippingAzn:shipping,totalAzn:total,currency:pick.code,rawPrice:pick.raw,
      verified:true,sourceScore:trustedSourceScore(url.hostname),matchScore:Math.round(match.score*100)/100,priceKind:pick.kind
    };
  } catch { return null; }
}
async function scanAiProduct(e, ownerId, productId, {notify=true,sync=true}={}) {
  const state=sync ? await syncAiWatches(e,ownerId) : await readState(e,ownerId);
  const watch=await e.DB.prepare('SELECT * FROM ai_price_watch WHERE owner_user_id=? AND product_id=?').bind(ownerId,productId).first();
  if(!watch) return { error:'Məhsul izləmədə tapılmadı.' };
  const country=aiCountry(state,watch.country_key);
  const results=await multiPriceSearch(watch.product_name,country.name||'');
  const offers=[];
  for(const result of results.slice(0,5)){ const offer=await offerFromPage(result,state,watch); if(offer) offers.push(offer); }
  offers.sort((a,b)=>(b.sourceScore||0)-(a.sourceScore||0) || a.totalAzn-b.totalAzn);
  await e.DB.prepare('DELETE FROM ai_price_offers WHERE owner_user_id=? AND product_id=?').bind(ownerId,productId).run();
  for(const o of offers.slice(0,5)){ await e.DB.prepare(`INSERT INTO ai_price_offers(id,owner_user_id,product_id,title,url,source,product_price_azn,shipping_azn,total_azn,currency,raw_price) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),ownerId,productId,String(o.title).slice(0,300),String(o.url).slice(0,1500),String(o.source).slice(0,150),o.productPriceAzn,o.shippingAzn,o.totalAzn,o.currency,o.rawPrice).run(); }
  const oldBest=Number(watch.best_total_azn)||0;
  const trustedOffers=offers.filter(o=>(o.sourceScore||0)>=80);
  const best=(trustedOffers.length?trustedOffers:offers).slice().sort((a,b)=>a.totalAzn-b.totalAzn)[0]||null, now=new Date().toISOString();
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
  const rows=await e.DB.prepare("SELECT owner_user_id,product_id FROM ai_price_watch WHERE enabled=1 ORDER BY COALESCE(last_scan_at,'1970-01-01') ASC LIMIT 3").all();
  for(const row of rows.results||[]){ try{ await scanAiProduct(e,row.owner_user_id,row.product_id,{notify:true,sync:false}); }catch{} }
}

let securitySchemaReady;
function ensureSecuritySchema(env) {
  if (!securitySchemaReady) {
    securitySchemaReady = (async () => {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS security_rate_limits (
        key_hash TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        window_start INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`).run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_security_rate_updated ON security_rate_limits(updated_at)").run();
      return true;
    })().catch((error) => { securitySchemaReady = null; throw error; });
  }
  return securitySchemaReady;
}
async function clientKey(request, env, scope, subject = '') {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const raw = `${scope}|${subject}|${ip}`;
  return mac(raw, env.AUTH_SECRET || 'stockpilot-rate-limit');
}
async function checkRateLimit(request, env, scope, { limit = 20, windowSec = 600, subject = '' } = {}) {
  await ensureSecuritySchema(env);
  const key = await clientKey(request, env, scope, subject);
  const now = Math.floor(Date.now() / 1000), threshold = now - windowSec;
  await env.DB.prepare(`INSERT INTO security_rate_limits(key_hash,count,window_start,updated_at)
    VALUES(?,1,?,?) ON CONFLICT(key_hash) DO UPDATE SET
      count=CASE WHEN security_rate_limits.window_start<? THEN 1 ELSE security_rate_limits.count+1 END,
      window_start=CASE WHEN security_rate_limits.window_start<? THEN excluded.window_start ELSE security_rate_limits.window_start END,
      updated_at=excluded.updated_at`)
    .bind(key, now, now, threshold, threshold).run();
  const row = await env.DB.prepare("SELECT count,window_start FROM security_rate_limits WHERE key_hash=?").bind(key).first();
  const allowed = (Number(row?.count) || 0) <= limit;
  const retryAfter = Math.max(1, windowSec - (now - (Number(row?.window_start) || now)));
  return { allowed, retryAfter };
}
function rateLimited(result) {
  return fail("Çox tez-tez sorğu göndərildi. Bir az sonra yenidən cəhd edin.", 429, { retryAfter: result.retryAfter });
}
async function authRateKey(request, env, scope, subject = '') {
  await ensureSecuritySchema(env);
  return clientKey(request, env, `auth:${scope}`, subject);
}
async function authRateStatus(request, env, scope, { limit = 20, windowSec = 900, subject = '' } = {}) {
  const key = await authRateKey(request, env, scope, subject);
  const row = await env.DB.prepare("SELECT count,window_start FROM security_rate_limits WHERE key_hash=?").bind(key).first();
  const now = Math.floor(Date.now() / 1000);
  if (!row) return { allowed: true, retryAfter: 0, key };
  if (now - (Number(row.window_start) || 0) >= windowSec) {
    await env.DB.prepare("DELETE FROM security_rate_limits WHERE key_hash=?").bind(key).run().catch(() => {});
    return { allowed: true, retryAfter: 0, key };
  }
  const allowed = (Number(row.count) || 0) < limit;
  return { allowed, retryAfter: Math.max(1, windowSec - (now - Number(row.window_start))), key };
}
async function authRateFailure(env, status) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`INSERT INTO security_rate_limits(key_hash,count,window_start,updated_at)
    VALUES(?,1,?,?) ON CONFLICT(key_hash) DO UPDATE SET count=security_rate_limits.count+1, updated_at=excluded.updated_at`)
    .bind(status.key, now, now).run();
}
async function authRateClear(env, status) {
  if (status?.key) await env.DB.prepare("DELETE FROM security_rate_limits WHERE key_hash=?").bind(status.key).run();
}
function safeParseJson(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}
function validateStateTree(value, depth = 0) {
  if (depth > 10) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e12;
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) return value.length <= 2_500_000;
    return value.length <= 20000;
  }
  if (Array.isArray(value)) return value.length <= 6000 && value.every((item) => validateStateTree(item, depth + 1));
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length <= 200 && entries.every(([key, item]) => key.length <= 100 && validateStateTree(item, depth + 1));
  }
  return false;
}
const PUBLIC_SELLER_DOMAINS = [
  'optimumnutrition.com','muscletech.com','dymatize.com','nowfoods.com','iherb.com','amazon.com','amazon.de','amazon.co.uk',
  'walmart.com','vitacost.com','bodybuilding.com','gnc.com','trendyol.com','hepsiburada.com'
];
function approvedSellerUrl(raw) {
  const url = safeExternalUrl(raw);
  if (!url || url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return PUBLIC_SELLER_DOMAINS.some((domain) => host === domain || host.endsWith('.' + domain)) ? url : null;
}

export default {
  async fetch(r, e) {
    const u = new URL(r.url),
      p = u.pathname;
    if (p.startsWith("/api/") && !e.AUTH_SECRET) return fail("Server security secret konfiqurasiya olunmayıb.", 503);
    if (p.startsWith("/api/") && !validRequestOrigin(r)) return fail("Sorğunun mənbəyi qəbul edilmir.", 403);
    if (p.startsWith("/api/images/")) {
      if (!e.IMAGES) return new Response("Not found", { status: 404 });
      let key;
      try { key = decodeURIComponent(p.slice(12)); } catch { return new Response("Not found", { status: 404 }); }
      if (!key || key.length > 500 || key.includes("..")) return new Response("Not found", { status: 404 });
      const o = await e.IMAGES.get(key);
      if (!o) return new Response("Not found", { status: 404 });
      const type = String(o.httpMetadata?.contentType || "").toLowerCase();
      if (!["image/jpeg","image/png","image/webp"].includes(type)) return new Response("Not found", { status: 404 });
      const headers = new Headers({ "content-type": type, "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" });
      applySecurityHeaders(headers);
      return new Response(o.body, { headers });
    }
    if (p === "/api/register" && r.method === "POST") {
      const requestId = r.headers.get('cf-ray') || crypto.randomUUID();
      try {
        await ensureAuthSchema(e);
        const length = Number(r.headers.get("content-length"));
        if (Number.isFinite(length) && length > 5_000_000) return fail("Qeydiyyat məlumatı çox böyükdür.", 413, { code: 'REGISTER_TOO_LARGE' });
        let f;
        try { f = await r.formData(); } catch { return fail("Qeydiyyat formu oxunmadı.", 400, { code: 'REGISTER_BAD_FORM' }); }
        const username = String(f.get("username") || "").trim().toLowerCase();
        const first = String(f.get("firstName") || "").trim();
        const last = String(f.get("lastName") || "").trim();
        const password = String(f.get("password") || "");
        if (!/^[a-z0-9_.-]{3,30}$/i.test(username) || !first || !last || first.length > 80 || last.length > 80)
          return fail("Bütün məlumatları düzgün yazın.", 400, { code: 'REGISTER_VALIDATION' });
        if (!/^\d{4}$/.test(password)) return fail("Şifrə 4 rəqəm olmalıdır.", 400, { code: 'REGISTER_PIN_FORMAT' });

        const rate = await authRateStatus(r, e, 'register', { limit: 20, windowSec: 900, subject: username.slice(0, 50) });
        if (!rate.allowed) return rateLimited(rate);
        if (await e.DB.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").bind(username).first()) {
          await authRateFailure(e, rate);
          return fail("Username artıq istifadə olunur.", 409, { code: 'REGISTER_USERNAME_TAKEN' });
        }

        const id = crypto.randomUUID();
        const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
        const passwordHash = await hashPassword(password, salt, PASSWORD_ITERATIONS);
        let key = null;
        const file = f.get("photo");
        if (file && typeof file !== "string" && file.size) {
          if (file.size > 4_000_000) return fail("Şəkil maksimum 4MB olmalıdır.", 400, { code: 'REGISTER_PHOTO_SIZE' });
          const type = String(file.type || "").toLowerCase();
          if (!["image/jpeg","image/png","image/webp"].includes(type)) return fail("Yalnız JPG, PNG və WEBP şəkilləri qəbul olunur.", 400, { code: 'REGISTER_PHOTO_TYPE' });
          if (e.IMAGES) {
            key = `profiles/${id}/${crypto.randomUUID()}`;
            await e.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: type } });
          }
        }

        const columns = await userColumns(e);
        const insertColumns = ['id','username','first_name','last_name','password_hash','salt'];
        const values = [id, username, first, last, passwordHash, salt];
        if (columns.has('password_iterations')) { insertColumns.push('password_iterations'); values.push(PASSWORD_ITERATIONS); }
        if (columns.has('photo_key')) { insertColumns.push('photo_key'); values.push(key); }
        if (columns.has('created_at')) { insertColumns.push('created_at'); values.push(new Date().toISOString()); }
        const placeholders = insertColumns.map(() => '?').join(',');
        const userInsert = e.DB.prepare(`INSERT INTO users(${insertColumns.join(',')}) VALUES(${placeholders})`).bind(...values);
        const stateInsert = e.DB.prepare("INSERT INTO user_state(user_id,state_json) VALUES(?,?)").bind(id, '{"orders":[],"customerSales":[]}');
        try {
          await e.DB.batch([userInsert, stateInsert]);
        } catch (error) {
          await authRateFailure(e, rate).catch(() => {});
          const text = String(error?.message || error || "");
          console.error("register database write failed", { requestId, username, columns: [...columns], error: text });
          if (/unique|constraint/i.test(text)) return fail("Username artıq istifadə olunur.", 409, { code: 'REGISTER_USERNAME_TAKEN', requestId });
          return fail("Hesab database-ə yazılmadı. Worker Logs-da request ID ilə yoxlayın.", 500, { code: 'REGISTER_DB_ERROR', requestId });
        }
        await authRateClear(e, rate).catch(() => {});
        const user = { id, username, first_name: first, last_name: last, photo_key: key };
        const token = await issue(user, e.AUTH_SECRET);
        return json({ user: pub(user) }, 201, { "set-cookie": sessionCookie(token) });
      } catch (error) {
        console.error('register unhandled', { requestId, error: String(error?.stack || error?.message || error) });
        return fail("Qeydiyyat zamanı server xətası baş verdi.", 500, { code: 'REGISTER_SERVER_ERROR', requestId });
      }
    }
    if (p === "/api/login" && r.method === "POST") {
      const requestId = r.headers.get('cf-ray') || crypto.randomUUID();
      try {
        await ensureAuthSchema(e);
        let body;
        try { body = await safeJson(r, 5000); }
        catch (error) { return fail(error.message === 'PAYLOAD_TOO_LARGE' ? "Sorğu çox böyükdür." : "JSON düzgün deyil.", error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { code: 'LOGIN_BAD_REQUEST' }); }
        const username = String(body.username || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (!/^[a-z0-9_.-]{3,30}$/i.test(username) || !/^\d{4}$/.test(password))
          return fail("Məlumatlar yanlışdır.", 401, { code: 'LOGIN_INVALID' });

        const rate = await authRateStatus(r, e, 'login', { limit: 20, windowSec: 900, subject: username.slice(0, 50) });
        if (!rate.allowed) return rateLimited(rate);
        const user = await e.DB.prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE").bind(username).first();
        if (!user) {
          // Keep timing closer to an existing account without exposing whether the username exists.
          await deriveHash(password, b64(new Uint8Array(16)), LEGACY_PASSWORD_ITERATIONS).catch(() => {});
          await authRateFailure(e, rate);
          console.warn('login rejected', { requestId, username, userFound: false });
          return fail("Məlumatlar yanlışdır.", 401, { code: 'LOGIN_INVALID' });
        }

        const verification = await verifyPassword(password, user.salt, user.password_hash, user.password_iterations);
        if (!verification.ok) {
          await authRateFailure(e, rate);
          const info = passwordHashInfo(user.password_hash, user.password_iterations);
          console.warn('login rejected', {
            requestId,
            username,
            userFound: true,
            hashKind: info.kind,
            hashLength: String(user.password_hash || '').trim().length,
            saltLength: String(user.salt || '').trim().length,
            iterationsHint: Number(user.password_iterations) || null,
          });
          return fail("Məlumatlar yanlışdır.", 401, { code: 'LOGIN_INVALID' });
        }

        // Normalize every successful legacy/prefixed hash to the simple v41 raw PBKDF2-210k format.
        if (verification.iterations !== PASSWORD_ITERATIONS || verification.kind !== 'raw' || Number(user.password_iterations) !== PASSWORD_ITERATIONS) {
          const newSalt = b64(crypto.getRandomValues(new Uint8Array(16)));
          const upgraded = await hashPassword(password, newSalt, PASSWORD_ITERATIONS);
          const columns = await userColumns(e);
          if (columns.has('password_iterations')) {
            await e.DB.prepare("UPDATE users SET password_hash=?,salt=?,password_iterations=? WHERE id=?")
              .bind(upgraded, newSalt, PASSWORD_ITERATIONS, user.id).run();
            user.password_iterations = PASSWORD_ITERATIONS;
          } else {
            await e.DB.prepare("UPDATE users SET password_hash=?,salt=? WHERE id=?").bind(upgraded, newSalt, user.id).run();
          }
          user.password_hash = upgraded;
          user.salt = newSalt;
        }
        await authRateClear(e, rate).catch(() => {});
        const token = await issue(user, e.AUTH_SECRET);
        return json({ user: pub(user) }, 200, { "set-cookie": sessionCookie(token) });
      } catch (error) {
        console.error('login unhandled', { requestId, error: String(error?.stack || error?.message || error) });
        return fail("Giriş zamanı server xətası baş verdi.", 500, { code: 'LOGIN_SERVER_ERROR', requestId });
      }
    }
    if (p === "/api/logout" && r.method === "POST") return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
    const storeMatch = p.match(/^\/api\/store\/([\w.-]{3,30})$/);
    if (storeMatch && r.method === "GET") {
      const owner = await e.DB.prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE").bind(storeMatch[1]).first();
      if (!owner) return fail("Mağaza tapılmadı.", 404);
      const state = await readState(e, owner.id);
      const reserved = await reservedStock(e, owner.id);
      // Kataloq tam görünür; aktiv müştəri sifarişlərində rezerv olunan say mövcud stokdan çıxılır.
      const storeSettings = await readStoreSettings(e, owner.id);
      const publicProducts = productList(state, reserved).map(({ quantity, sold, orderId, index, ...product }) => product);
      return json({ shop: { username: owner.username, name: `${owner.first_name} ${owner.last_name}`, originLabel: storeSettings.originLabel }, products: publicProducts });
    }
    const storeQuoteMatch = p.match(/^\/api\/store\/([\w.-]{3,30})\/delivery-quote$/);
    if (storeQuoteMatch && r.method === "POST") {
      const rl = await checkRateLimit(r, e, "delivery-quote", { limit: 60, windowSec: 600, subject: storeQuoteMatch[1] });
      if (!rl.allowed) return rateLimited(rl);
      const owner = await e.DB.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").bind(storeQuoteMatch[1]).first();
      if (!owner) return fail("Mağaza tapılmadı.", 404);
      let body; try { body = await safeJson(r, 10000); } catch { return fail("Sorğu düzgün deyil."); }
      const lat = Number(body.lat), lng = Number(body.lng), preferredAt = String(body.preferredAt || "");
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return fail("Çatdırılma konumu düzgün deyil.");
      if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::\d{2})?$/.test(preferredAt)) return fail("Çatdırılma vaxtı düzgün deyil.");
      return json(await calculateDeliveryQuote(e, owner.id, lat, lng, preferredAt));
    }
    const storeTrackMatch = p.match(/^\/api\/store\/([\w.-]{3,30})\/orders\/([0-9a-fA-F-]{36})$/);
    if (storeTrackMatch && r.method === "GET") {
      const rl = await checkRateLimit(r, e, "order-track", { limit: 120, windowSec: 600, subject: storeTrackMatch[1] });
      if (!rl.allowed) return rateLimited(rl);
      const owner = await e.DB.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").bind(storeTrackMatch[1]).first();
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
      const rl = await checkRateLimit(r, e, "store-order", { limit: 20, windowSec: 600, subject: storeOrderMatch[1] });
      if (!rl.allowed) return rateLimited(rl);
      const owner = await e.DB.prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE").bind(storeOrderMatch[1]).first();
      if (!owner) return fail("Mağaza tapılmadı.", 404);
      let body; try { body = await safeJson(r, 100000); } catch (error) { return fail(error.message === 'PAYLOAD_TOO_LARGE' ? "Sifariş çox böyükdür." : "JSON düzgün deyil.", error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400); }
      const name = String(body.name || "").trim().slice(0, 100);
      const phone = String(body.phone || "").trim().slice(0, 30);
      const phoneDigits = phone.replace(/\D/g, '');
      if (!name || phoneDigits.length < 7 || phoneDigits.length > 15 || !Array.isArray(body.cart) || !body.cart.length) return fail("Ad, telefon və məhsullar tələb olunur.");
      if (body.cart.length > 100) return fail("Bir sifarişdə maksimum 100 fərqli məhsul ola bilər.");
      const products = productList(await readState(e, owner.id));
      const cart = [];
      const seen = new Map();
      for (const line of body.cart) {
        const id = String(line?.id || '').slice(0, 200);
        const rawQty = Number(line?.quantity);
        const quantity = Number.isInteger(rawQty) ? rawQty : Math.floor(rawQty);
        if (!id || !Number.isFinite(quantity) || quantity < 1 || quantity > 999) return fail("Məhsul sayı düzgün deyil.");
        seen.set(id, Math.min(999, (seen.get(id) || 0) + quantity));
      }
      for (const [id, quantity] of seen) {
        const product = products.find((x) => String(x.id) === id);
        if (!product) return fail("Məhsul tapılmadı.", 404);
        cart.push({ ...product, price: Math.max(0, Number(product.price) || 0), quantity });
      }
      const preferredAt = String(body.preferredAt || "").slice(0, 40);
      if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::\d{2})?$/.test(preferredAt)) return fail("Çatdırılma tarix və saatını 24 saat formatında yazın.");
      if (preferredAt.slice(0, 10) < new Date().toISOString().slice(0, 10)) return fail("Keçmiş tarix seçilə bilməz.");
      const delivery = String(body.delivery || "metro");
      if (!['metro','address'].includes(delivery)) return fail("Çatdırılma üsulu düzgün deyil.");
      const payment = String(body.payment || "cash");
      if (!['cash','card'].includes(payment)) return fail("Ödəniş üsulu düzgün deyil.");
      const preferredMs = Date.parse(preferredAt);
      if (!Number.isFinite(preferredMs) || preferredMs > Date.now() + 366 * 86400000) return fail("Çatdırılma tarixi həddən artıq uzaqdır.");
      let deliveryFee = 0, deliveryDistanceKm = 0, deliveryPeriodLabel = "";
      let deliveryLat = null, deliveryLng = null;
      if (delivery === "address") {
        deliveryLat = Number(body.deliveryLat); deliveryLng = Number(body.deliveryLng);
        if (!Number.isFinite(deliveryLat) || deliveryLat < -90 || deliveryLat > 90 || !Number.isFinite(deliveryLng) || deliveryLng < -180 || deliveryLng > 180) return fail("Çatdırılma konumunu xəritədən seçin.");
        const quote = await calculateDeliveryQuote(e, owner.id, deliveryLat, deliveryLng, preferredAt);
        deliveryFee = quote.fee; deliveryDistanceKm = quote.distanceKm; deliveryPeriodLabel = quote.periodLabel;
      }
      const subtotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
      const order = { id: crypto.randomUUID(), customer: { name, phone, note: String(body.note || "").trim().slice(0, 500), delivery, metro: String(body.metro || "").trim().slice(0, 120), address: String(body.address || "").trim().slice(0, 300), payment, preferredAt, deliveryLat, deliveryLng }, cart, subtotal, deliveryFee, deliveryDistanceKm, deliveryPeriodLabel, total: subtotal + deliveryFee, createdAt: new Date().toISOString() };
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
      const rl = await checkRateLimit(r, e, "ai-scan-all", { limit: 6, windowSec: 3600, subject: user.id });
      if (!rl.allowed) return rateLimited(rl);
      const payload=await aiPurchasePayload(e,user.id);
      const enabled=payload.watches.filter(w=>w.enabled).slice(0,3);
      const results=[];
      for(const w of enabled){ try{ results.push(await scanAiProduct(e,user.id,w.productId,{notify:true,sync:false})); }catch(err){ results.push({productId:w.productId,error:String(err?.message||err)}); } }
      return json({ok:true,scanned:results.length});
    }
    const aiScanMatch=p.match(/^\/api\/ai-purchases\/([^/]+)\/scan$/);
    if(aiScanMatch && r.method === "POST") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      const rl = await checkRateLimit(r, e, "ai-scan-one", { limit: 20, windowSec: 3600, subject: user.id });
      if (!rl.allowed) return rateLimited(rl);
      let productId; try { productId = decodeURIComponent(aiScanMatch[1]); } catch { return fail("Məhsul ID düzgün deyil."); }
      if (!productId || productId.length > 200) return fail("Məhsul ID düzgün deyil.");
      return json(await scanAiProduct(e,user.id,productId,{notify:true}));
    }
    const aiWatchMatch=p.match(/^\/api\/ai-purchases\/([^/]+)$/);
    if(aiWatchMatch && r.method === "PUT") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      await ensureAiPurchaseSchema(e);
      let id; try { id=decodeURIComponent(aiWatchMatch[1]); } catch { return fail('Məhsul ID düzgün deyil.'); }
      if (!id || id.length > 200) return fail('Məhsul ID düzgün deyil.');
      let body; try { body=await safeJson(r,5000); } catch { return fail('Ayar məlumatı düzgün deyil.'); }
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
        let body; try { body = await safeJson(r, 10000); } catch { return fail("Tarif məlumatı düzgün deyil."); }
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
      let body; try { body = await safeJson(r, 20000); } catch { return fail("Profil məlumatı düzgün deyil."); }
      const first = String(body.firstName || "").trim();
      const last = String(body.lastName || "").trim();
      const username = String(body.username || "").trim().toLowerCase();
      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");
      if (!first || !last || first.length > 80 || last.length > 80 || !/^[a-z0-9_.-]{3,30}$/i.test(username))
        return fail("Ad, soyad və username düzgün yazılmalıdır.");
      const other = await e.DB.prepare(
        "SELECT id FROM users WHERE username=? COLLATE NOCASE AND id<>?",
      )
        .bind(username, user.id)
        .first();
      if (other) return fail("Bu username artıq istifadə olunur.", 409);
      let passwordHash = user.password_hash;
      let passwordSalt = user.salt;
      let passwordIterations = Number(user.password_iterations) || LEGACY_PASSWORD_ITERATIONS;
      if (newPassword) {
        if (!/^\d{4}$/.test(newPassword))
          return fail("Yeni şifrə 4 rəqəm olmalıdır.");
        const currentCheck = await verifyPassword(currentPassword, user.salt, user.password_hash, user.password_iterations);
        if (!currentCheck.ok) return fail("Hazırkı şifrə yanlışdır.", 401);
        passwordSalt = b64(crypto.getRandomValues(new Uint8Array(16)));
        passwordIterations = PASSWORD_ITERATIONS;
        passwordHash = await hashPassword(newPassword, passwordSalt, passwordIterations);
      }
      const profileColumns = await userColumns(e);
      if (profileColumns.has('password_iterations')) {
        await e.DB.prepare(
          "UPDATE users SET username=?,first_name=?,last_name=?,password_hash=?,salt=?,password_iterations=? WHERE id=?",
        ).bind(username, first, last, passwordHash, passwordSalt, passwordIterations, user.id).run();
      } else {
        await e.DB.prepare(
          "UPDATE users SET username=?,first_name=?,last_name=?,password_hash=?,salt=? WHERE id=?",
        ).bind(username, first, last, passwordHash, passwordSalt, user.id).run();
      }
      const updated = {
        ...user,
        username,
        first_name: first,
        last_name: last,
        password_hash: passwordHash,
        salt: passwordSalt,
        password_iterations: passwordIterations,
      };
      const token = await issue(updated, e.AUTH_SECRET);
      return json({ user: pub(updated) }, 200, { "set-cookie": sessionCookie(token) });
    }
    if (p === "/api/state") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      if (r.method === "GET") return json({ state: await readState(e, user.id) });
      if (r.method === "PUT") {
        let body;
        try { body = await safeJson(r, 8_500_000); } catch (error) { return fail(error.message === 'PAYLOAD_TOO_LARGE' ? "Məlumat ölçüsü çox böyükdür." : "JSON düzgün deyil.", error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400); }
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
      const orders = (rows.results || []).map((row) => { const parsed = safeParseJson(row.order_json); return parsed ? { ...parsed, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at } : null; }).filter(Boolean);
      return json({ orders });
    }
    if (p === "/api/notifications" && r.method === "GET") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      await ensureNotifications(e);
      const rows = await e.DB.prepare("SELECT id,kind,title,body,data_json,is_read,created_at FROM notifications WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
      return json({ notifications: (rows.results || []).map((row) => ({ id: row.id, kind: row.kind, title: row.title, body: row.body, data: row.data_json ? safeParseJson(row.data_json) : null, read: Boolean(row.is_read), createdAt: row.created_at })) });
    }
    if (p === "/api/notifications" && r.method === "POST") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      const rl = await checkRateLimit(r, e, "notification-send", { limit: 20, windowSec: 3600, subject: user.id });
      if (!rl.allowed) return rateLimited(rl);
      let body; try { body = await safeJson(r, 5000); } catch { return fail("Bildiriş məlumatı düzgün deyil."); }
      const username = String(body.username || "").trim().toLowerCase();
      const title = String(body.title || "Bildiriş").trim().slice(0, 100);
      const message = String(body.message || "").trim().slice(0, 500);
      if (!username || !message) return fail("Username və bildiriş mətni tələb olunur.");
      const recipient = await e.DB.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").bind(username).first();
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
      let body; try { body = await safeJson(r, 20000); } catch { return fail("Sifariş məlumatı düzgün deyil."); }
      const status = String(body.status || "new");
      if (!['new','confirmed','preparing','courier','delivered','cancelled'].includes(status)) return fail("Status düzgün deyil.");
      const row = await e.DB.prepare("SELECT order_json,status FROM customer_orders WHERE id=? AND owner_user_id=?").bind(customerMatch[1], user.id).first();
      if (!row) return fail("Sifariş tapılmadı.", 404);
      const order = safeParseJson(row.order_json);
      if (!order) return fail("Sifariş məlumatı oxunmadı.", 500);
      if (["delivered","cancelled"].includes(row.status) && status !== row.status) return fail("Tamamlanmış və ya ləğv edilmiş sifarişin statusu dəyişdirilə bilməz.", 409);
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
      if (status === 'delivered' && row.status !== 'delivered' && !order.inventoryAppliedAt) {
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
        order.inventoryAppliedAt = new Date().toISOString();
      }
      await e.DB.prepare("UPDATE customer_orders SET order_json=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_user_id=?").bind(JSON.stringify(order), status, customerMatch[1], user.id).run();
      const messageSent = status !== row.status ? await sendWhatsAppStatus(e, order, status).catch(() => false) : false;
      if (status !== row.status) await notification(e, user.id, "order-status", `Sifariş statusu: ${whatsappStatuses[status] || status}`, `${order.customer?.name || "Müştəri"} · ${order.total?.toFixed?.(2) || order.total || 0} ₼`, { orderId: customerMatch[1], status });
      return json({ ok: true, messageSent, whatsappUrl: whatsappUrl(order, status), order: { ...order, status } });
    }
    const asset = await e.ASSETS.fetch(r);
    const headers = new Headers(asset.headers);
    const type = headers.get("content-type") || "";
    applySecurityHeaders(headers, { html: type.includes("text/html") });
    if (type.includes("text/html")) headers.set("cache-control", "no-cache");
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  },
  async scheduled(event, e, ctx) {
    ctx.waitUntil((async () => {
      await scanAllAiWatches(e);
      try {
        await ensureSecuritySchema(e);
        const cutoff = Math.floor(Date.now()/1000) - 172800;
        await e.DB.prepare("DELETE FROM security_rate_limits WHERE updated_at<?").bind(cutoff).run();
      } catch {}
    })());
  },
};
