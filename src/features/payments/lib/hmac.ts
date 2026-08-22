import { createHmac, timingSafeEqual } from 'node:crypto';

/** Constant-time hex HMAC-SHA256 compare. */
export function verifyHmacSha256Hex(secret: string, payload: string, signature: string): boolean {
  if (!secret || !payload || !signature) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  try {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(signature, 'utf8');
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}
