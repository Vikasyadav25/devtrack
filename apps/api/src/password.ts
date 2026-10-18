import { pbkdf2, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { randomToken } from './session';
const iterations = 600000;
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    pbkdf2(password, salt, iterations, 32, 'sha256', (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomToken();
  const key = await derive(password, salt);
  return `pbkdf2-sha256$${iterations}$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [scheme, cost, salt, hash] = encoded.split('$');
  if (
    scheme !== 'pbkdf2-sha256' ||
    Number(cost) !== iterations ||
    !/^[a-f0-9]{64}$/.test(salt ?? '') ||
    !/^[a-f0-9]{64}$/.test(hash ?? '')
  )
    return false;
  const key = await derive(password, salt);
  return timingSafeEqual(key, Buffer.from(hash, 'hex'));
}
// Same work for unknown accounts; this is a non-loginable comparison hash.
export const dummyPasswordHash = `pbkdf2-sha256$${iterations}$${'0'.repeat(64)}$${'0'.repeat(64)}`;
