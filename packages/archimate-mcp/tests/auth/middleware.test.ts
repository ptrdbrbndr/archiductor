import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { verifyJwt } from '../../src/auth/middleware.js';

const SECRET = 'test-secret-at-least-32-chars-long!!';
process.env['MCP_JWT_SECRET'] = SECRET;

async function makeToken(payload: Record<string, unknown>, expiresIn = '1h') {
  const secret = new TextEncoder().encode(SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .sign(secret);
}

describe('verifyJwt', () => {
  it('accepts valid token with matching model_id', async () => {
    const token = await makeToken({ user_id: 'user-1', model_id: 'model-1' });
    const ctx = await verifyJwt(`Bearer ${token}`, 'model-1');
    expect(ctx.userId).toBe('user-1');
    expect(ctx.modelId).toBe('model-1');
  });

  it('rejects missing Authorization header', async () => {
    await expect(verifyJwt(undefined, 'model-1')).rejects.toThrow('Missing');
  });

  it('rejects non-Bearer header', async () => {
    await expect(verifyJwt('Basic abc', 'model-1')).rejects.toThrow('Missing');
  });

  it('rejects mismatched model_id', async () => {
    const token = await makeToken({ user_id: 'user-1', model_id: 'model-1' });
    await expect(verifyJwt(`Bearer ${token}`, 'model-2')).rejects.toThrow('model_id');
  });

  it('rejects expired token', async () => {
    const token = await makeToken({ user_id: 'user-1', model_id: 'model-1' }, '0s');
    await expect(verifyJwt(`Bearer ${token}`, 'model-1')).rejects.toThrow();
  });

  it('rejects invalid JWT payload (missing user_id)', async () => {
    const token = await makeToken({ model_id: 'model-1' });
    await expect(verifyJwt(`Bearer ${token}`, 'model-1')).rejects.toThrow('Invalid JWT payload');
  });
});
