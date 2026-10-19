import { pbkdf2, scrypt, timingSafeEqual } from 'node:crypto';
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

// Native scrypt avoids the hosted Workers PBKDF2 iteration cap for private login.
function derivePrivate(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 32, { N: 16384, r: 8, p: 5 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashPrivatePassword(password: string) {
  const salt = randomToken();
  return `scrypt$16384$8$5$${salt}$${(await derivePrivate(password, salt)).toString('hex')}`;
}
export async function verifyPrivatePassword(password: string, encoded?: string) {
  const value = encoded ?? `scrypt$16384$8$5$${'0'.repeat(64)}$${'0'.repeat(64)}`;
  const [scheme, cost, block, parallel, salt, hash] = value.split('$');
  if (
    scheme !== 'scrypt' ||
    cost !== '16384' ||
    block !== '8' ||
    parallel !== '5' ||
    !/^[a-f0-9]{64}$/.test(salt ?? '') ||
    !/^[a-f0-9]{64}$/.test(hash ?? '')
  )
    return false;
  return timingSafeEqual(await derivePrivate(password, salt), Buffer.from(hash, 'hex'));
}
