import { pbkdf2Sync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

function normalizeBase64(value) {
  const text = String(value || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  return text.padEnd(Math.ceil(text.length / 4) * 4, '=');
}
function parseInfo(stored, iterationsHint, saltHint) {
  const value = String(stored || '').trim();
  const v2 = value.match(/^v2:(\d+):([A-Za-z0-9+/_=-]+):([A-Za-z0-9+/_=-]+)$/);
  if (v2) return { kind:'v2', iterations:Number(v2[1]), salt:normalizeBase64(v2[2]), hash:normalizeBase64(v2[3]) };
  const prefixed = value.match(/^pbkdf2\$(\d+)\$([A-Za-z0-9+/_=-]+)$/);
  if (prefixed) return { kind:'prefixed', iterations:Number(prefixed[1]), salt:normalizeBase64(saltHint), hash:normalizeBase64(prefixed[2]) };
  if (/^[A-Za-z0-9+/_-]{43}=?$/.test(value) || /^[A-Za-z0-9+/_-]{44}$/.test(value)) {
    return { kind:'raw', iterations:Number(iterationsHint)||100000, salt:normalizeBase64(saltHint), hash:normalizeBase64(value) };
  }
  if (/^\d{4}$/.test(value)) return { kind:'literal', iterations:0, salt:'', hash:value };
  return { kind:'unknown', iterations:0, salt:'', hash:'' };
}
async function hiddenPin(prompt) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    const rl = readline.createInterface({ input, output });
    const value = await rl.question(prompt); rl.close(); return value;
  }
  output.write(prompt); input.setRawMode(true); input.resume(); input.setEncoding('utf8');
  return new Promise((resolve,reject)=>{
    let value='';
    const cleanup=()=>{ input.off('data',onData); input.setRawMode(false); input.pause(); };
    const onData=(ch)=>{
      if(ch==='\u0003'){cleanup();output.write('\n');return reject(new Error('Ləğv edildi.'));}
      if(ch==='\r'||ch==='\n'){cleanup();output.write('\n');return resolve(value);}
      if(ch==='\u007f'||ch==='\b'){if(value.length){value=value.slice(0,-1);output.write('\b \b');}return;}
      if(/\d/.test(ch)&&value.length<4){value+=ch;output.write('•');}
    };
    input.on('data',onData);
  });
}

const username = String(process.argv[2] || '').trim().toLowerCase();
if (!/^[a-z0-9_.-]{3,30}$/i.test(username)) {
  console.error('İstifadə: node auth-diagnose.mjs username'); process.exit(1);
}
const sql = `SELECT username,password_hash,salt,password_iterations FROM users WHERE username='${username.replaceAll("'","''")}' COLLATE NOCASE LIMIT 1;`;
let raw;
try {
  raw = execFileSync('npx.cmd', ['wrangler','d1','execute','stockpilot-db','--remote','--command',sql,'--json'], { encoding:'utf8', stdio:['ignore','pipe','pipe'] });
} catch (e) {
  console.error('D1 oxunmadı. Wrangler login və database bağlantısını yoxla.');
  console.error(String(e.stderr || e.message || e)); process.exit(1);
}
let payload;
try { payload = JSON.parse(raw); }
catch {
  const start = raw.indexOf('['), end = raw.lastIndexOf(']');
  if (start < 0 || end < start) { console.error('Wrangler JSON cavabı parse olunmadı.'); process.exit(1); }
  payload = JSON.parse(raw.slice(start,end+1));
}
const rows = Array.isArray(payload) ? (payload[0]?.results || payload[0]?.result || []) : (payload?.results || []);
const row = rows[0];
if (!row) { console.log('USER_FOUND=false'); process.exit(0); }
const info = parseInfo(row.password_hash, row.password_iterations, row.salt);
console.log('USER_FOUND=true');
console.log(`HASH_KIND=${info.kind}`);
console.log(`ITERATIONS=${info.iterations}`);
console.log(`SALT_LEN=${String(row.salt||'').length}`);
console.log(`HASH_LEN=${String(row.password_hash||'').length}`);
const pin = String(await hiddenPin('Yoxlama üçün 4 rəqəmli PIN: ')).trim();
if(!/^\d{4}$/.test(pin)){console.error('PIN 4 rəqəm olmalıdır.');process.exit(1);}
let match=false;
if(info.kind==='literal') match = pin === info.hash;
else if(['v2','prefixed','raw'].includes(info.kind)) {
  try {
    const derived = pbkdf2Sync(pin, Buffer.from(info.salt,'base64'), info.iterations, 32, 'sha256').toString('base64');
    match = normalizeBase64(derived) === info.hash;
  } catch {}
}
console.log(`MATCH=${match ? 'true' : 'false'}`);
console.log(match ? 'NƏTİCƏ: D1-dəki hash bu PIN-lə uyğundur. Problem Worker login axınındadır.' : 'NƏTİCƏ: D1-dəki hash bu PIN-lə uyğun deyil. Reset/DB yazılması tərəfini düzəltmək lazımdır.');
