import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const username = String(process.argv[2] || '').trim().toLowerCase();
if (!/^[a-z0-9_.-]{3,30}$/i.test(username)) {
  console.error('İstifadə: node reset-pin.mjs username');
  process.exit(1);
}
const rl = readline.createInterface({ input, output });
const pin = String(await rl.question('Yeni 4 rəqəmli PIN: ')).trim();
rl.close();
if (!/^\d{4}$/.test(pin)) {
  console.error('PIN dəqiq 4 rəqəm olmalıdır.');
  process.exit(1);
}
const salt = randomBytes(16).toString('base64');
const digest = createHash('sha256').update(`${salt}:${pin}`, 'utf8').digest('hex');
const resetHash = `reset:${salt}:${digest}`;
const safeUser = username.replaceAll("'", "''");
const sql = `UPDATE users SET salt='${salt}', password_hash='${resetHash}', password_iterations=0 WHERE username='${safeUser}' COLLATE NOCASE;\nDELETE FROM security_rate_limits;\n`;
writeFileSync('reset-pin.sql', sql, 'utf8');
console.log('\nreset-pin.sql yaradıldı.');
console.log('İndi işə sal:');
console.log('npx.cmd wrangler d1 execute stockpilot-db --remote --file reset-pin.sql');
console.log('\nİlk uğurlu login-dən sonra Worker bunu avtomatik v3 təhlükəsiz hash-ə çevirəcək.');
