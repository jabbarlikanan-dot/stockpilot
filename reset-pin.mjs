import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

async function hiddenPin(prompt) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    const rl = readline.createInterface({ input, output });
    const value = await rl.question(prompt);
    rl.close();
    return value;
  }
  output.write(prompt);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');
  return new Promise((resolvePin, reject) => {
    let value = '';
    const onData = (ch) => {
      if (ch === '\u0003') {
        cleanup();
        output.write('\n');
        reject(new Error('Ləğv edildi.'));
        return;
      }
      if (ch === '\r' || ch === '\n') {
        cleanup();
        output.write('\n');
        resolvePin(value);
        return;
      }
      if (ch === '\u007f' || ch === '\b') {
        if (value.length) { value = value.slice(0, -1); output.write('\b \b'); }
        return;
      }
      if (/\d/.test(ch) && value.length < 4) { value += ch; output.write('•'); }
    };
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
    };
    input.on('data', onData);
  });
}

const rl = readline.createInterface({ input, output });
const usernameArg = String(process.argv[2] || '').trim();
const username = (usernameArg || await rl.question('Username: ')).trim().toLowerCase();
rl.close();
const pin = String(await hiddenPin('Yeni 4 rəqəmli PIN: ')).trim();

if (!/^[a-z0-9_.-]{3,30}$/i.test(username)) {
  console.error('Username formatı düzgün deyil.');
  process.exit(1);
}
if (!/^\d{4}$/.test(pin)) {
  console.error('PIN dəqiq 4 rəqəm olmalıdır.');
  process.exit(1);
}

const salt = randomBytes(16).toString('base64');
const hash = pbkdf2Sync(pin, Buffer.from(salt, 'base64'), 210000, 32, 'sha256').toString('base64');
const safeUser = username.replaceAll("'", "''");
const sql = `UPDATE users SET salt='${salt}', password_hash='${hash}', password_iterations=210000 WHERE username='${safeUser}' COLLATE NOCASE;\nDELETE FROM security_rate_limits;\n`;
const out = resolve('tools', 'reset-pin.sql');
writeFileSync(out, sql, 'utf8');
console.log(`\nHazırdır: ${out}`);
console.log('İndi bunu işə sal:');
console.log('npx.cmd wrangler d1 execute stockpilot-db --remote --file tools/reset-pin.sql');
