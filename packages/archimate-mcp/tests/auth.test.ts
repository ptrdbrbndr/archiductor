import { describe, it, expect, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import { validateAuth } from '../src/auth/middleware.js';

const TEST_SECRET = 'test-secret-at-least-32-characters-long-abc';
const USER_ID = 'user-abc-123';
const MODEL_ID = 'model-xyz-456';

async function sign(payload: Record<string, unknown>, secret = TEST_SECRET, expiresIn = '1h'): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

beforeEach(() => {
  process.env['MCP_JWT_SECRET'] = TEST_SECRET;
});

describe('validateAuth', () => {
  describe('valid token', () => {
    it('returns ok:true with payload for a valid token', async () => {
      const token = await sign({ user_id: USER_ID, model_id: MODEL_ID });
      const result = await validateAuth(`Bearer ${token}`, MODEL_ID);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.user_id).toBe(USER_ID);
        expect(result.payload.model_id).toBe(MODEL_ID);
      }
    });

    it('accepts token without Bearer prefix', async () => {
      const token = await sign({ user_id: USER_ID, model_id: MODEL_ID });
      const result = await validateAuth(token, MODEL_ID);
      expect(result.ok).toBe(true);
    });
  });

  describe('MISSING_TOKEN', () => {
    it('returns MISSING_TOKEN for undefined token', async () => {
      const result = await validateAuth(undefined, MODEL_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MISSING_TOKEN');
      }
    });

    it('returns MISSING_TOKEN for empty string', async () => {
      const result = await validateAuth('', MODEL_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MISSING_TOKEN');
      }
    });
  });

  describe('EXPIRED_TOKEN', () => {
    it('returns EXPIRED_TOKEN for a token that expired in the past', async () => {
      const token = await sign({ user_id: USER_ID, model_id: MODEL_ID }, TEST_SECRET, '1s');
      // Wait just enough for the token to expire (jose uses exact exp, allow clock skew)
      await new Promise((r) => setTimeout(r, 1500));
      const result = await validateAuth(`Bearer ${token}`, MODEL_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EXPIRED_TOKEN');
      }
    });
  });

  describe('MODEL_MISMATCH', () => {
    it('returns MODEL_MISMATCH when model_id in token differs from toolModelId', async () => {
      const token = await sign({ user_id: USER_ID, model_id: 'different-model-id' });
      const result = await validateAuth(`Bearer ${token}`, MODEL_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MODEL_MISMATCH');
      }
    });
  });

  describe('INVALID_TOKEN', () => {
    it('returns INVALID_TOKEN for a tampered token', async () => {
      const result = await validateAuth('Bearer not.a.valid.jwt', MODEL_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_TOKEN');
      }
    });

    it('returns INVALID_TOKEN for token signed with wrong secret', async () => {
      const token = await sign({ user_id: USER_ID, model_id: MODEL_ID }, 'wrong-secret-that-is-also-32-chars-xyz');
      const result = await validateAuth(`Bearer ${token}`, MODEL_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_TOKEN');
      }
    });

    it('returns INVALID_TOKEN for token missing required fields', async () => {
      const token = await sign({ sub: 'someone' });
      const result = await validateAuth(`Bearer ${token}`, MODEL_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_TOKEN');
      }
    });
  });
});
