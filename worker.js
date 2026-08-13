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
        .bind(id, '{"orders":[]}')
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
    const user = await who(r, e);
    if (p === "/api/me")
      return user
        ? json({ user: pub(user) })
        : fail("Giriş tələb olunur.", 401);
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
    return e.ASSETS.fetch(r);
  },
};
