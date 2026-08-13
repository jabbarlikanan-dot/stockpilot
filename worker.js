const json = (x, s = 200) =>
    new Response(JSON.stringify(x), {
      status: s,
      headers: { "content-type": "application/json" },
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
  const v = (r.headers.get("authorization") || "").split(" "),
    [h, p, s] = (v[1] || "").split(".");
  if (v[0] !== "Bearer" || !h || s !== (await mac(`${h}.${p}`, e.AUTH_SECRET)))
    return null;
  const t = JSON.parse(atob(p));
  if (t.exp < Date.now()) return null;
  return e.DB.prepare("SELECT * FROM users WHERE id=?").bind(t.sub).first();
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
  return row ? JSON.parse(row.state_json) : { orders: [] };
};
const productList = (state) =>
  (state.orders || []).flatMap((order) =>
    (order.items || []).map((item, index) => ({
      id: item.id || `${order.id}:${index}`,
      name: item.name,
      category: item.category || "Digər",
      price: Number(item.sale) || 0,
      quantity: Number(item.qty) || 0,
      image: item.img || "",
      orderId: order.id,
      index,
      sold: Boolean(item.sold),
    })),
  );
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
      return json({ shop: { username: owner.username, name: `${owner.first_name} ${owner.last_name}` }, products: productList(state).filter((x) => !x.sold && x.quantity > 0) });
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
        const product = products.find((x) => x.id === line.id && !x.sold);
        const quantity = Math.max(1, Number(line.quantity) || 1);
        if (!product || quantity > product.quantity) return fail("Məhsul stokda yoxdur.", 409);
        cart.push({ ...product, quantity });
      }
      const order = { id: crypto.randomUUID(), customer: { name, phone, note: String(body.note || "").slice(0, 500), delivery: String(body.delivery || "metro"), metro: String(body.metro || ""), address: String(body.address || ""), payment: String(body.payment || "cash"), preferredAt: String(body.preferredAt || "").slice(0, 40) }, cart, total: cart.reduce((s, x) => s + x.price * x.quantity, 0), createdAt: new Date().toISOString() };
      await e.DB.prepare("INSERT INTO customer_orders(id,owner_user_id,order_json,status) VALUES(?,?,?,?)").bind(order.id, owner.id, JSON.stringify(order), "new").run();
      return json({ ok: true, orderId: order.id }, 201);
    }
    const user = await who(r, e);
    if (p === "/api/me")
      return user
        ? json({ user: pub(user) })
        : fail("Giriş tələb olunur.", 401);
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
      if (r.method === "GET") {
        const row = await e.DB.prepare(
          "SELECT state_json FROM user_state WHERE user_id=?",
        )
          .bind(user.id)
          .first();
        return json({ state: JSON.parse(row.state_json) });
      }
      if (r.method === "PUT") {
        const { state } = await r.json();
        await e.DB.prepare(
          "UPDATE user_state SET state_json=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
        )
          .bind(JSON.stringify(state), user.id)
          .run();
        return json({ ok: true });
      }
    }
    if (p === "/api/customer-orders" && r.method === "GET") {
      if (!user) return fail("Giriş tələb olunur.", 401);
      const rows = await e.DB.prepare("SELECT id,order_json,status,created_at,updated_at FROM customer_orders WHERE owner_user_id=? ORDER BY created_at DESC").bind(user.id).all();
      return json({ orders: (rows.results || []).map((row) => ({ ...JSON.parse(row.order_json), status: row.status, createdAt: row.created_at, updatedAt: row.updated_at })) });
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
            if (itemId === line.id) {
              const deliveredQty = Math.min(Number(item.qty) || 0, Number(line.quantity) || 0);
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
      return json({ ok: true, messageSent, order: { ...order, status } });
    }
    return e.ASSETS.fetch(r);
  },
};
