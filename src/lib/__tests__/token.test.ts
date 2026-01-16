import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Payment Token System', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.PAYMENT_TOKEN_SECRET = 'test-secret-key-for-testing';
    process.env.TREASURY_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createPaymentToken', () => {
    it('should create a valid token with payload', async () => {
      const { createPaymentToken, verifyPaymentToken } = await import('../token');
      
      const payload = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        treasuryAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        requiredAmountWei: '100000000000000',
        chainId: 8453,
        expiresAt: Date.now() + 600000,
        nonce: 'test-nonce-123',
      };
      
      const token = createPaymentToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(2);
    });

    it('should create different tokens for different payloads', async () => {
      const { createPaymentToken } = await import('../token');
      
      const basePayload = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        treasuryAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        requiredAmountWei: '100000000000000',
        chainId: 8453,
        expiresAt: Date.now() + 600000,
        nonce: 'nonce-1',
      };
      
      const token1 = createPaymentToken(basePayload);
      const token2 = createPaymentToken({ ...basePayload, nonce: 'nonce-2' });
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyPaymentToken', () => {
    it('should verify a valid token and return payload', async () => {
      const { createPaymentToken, verifyPaymentToken } = await import('../token');
      
      const payload = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        treasuryAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        requiredAmountWei: '100000000000000',
        chainId: 8453,
        expiresAt: Date.now() + 600000,
        nonce: 'test-nonce',
      };
      
      const token = createPaymentToken(payload);
      const result = verifyPaymentToken(token);
      
      expect(result.payload).not.toBeNull();
      expect(result.payload?.walletAddress).toBe(payload.walletAddress);
      expect(result.payload?.treasuryAddress).toBe(payload.treasuryAddress);
      expect(result.payload?.requiredAmountWei).toBe(payload.requiredAmountWei);
      expect(result.payload?.chainId).toBe(payload.chainId);
      expect(result.payload?.nonce).toBe(payload.nonce);
    });

    it('should reject expired token with error info', async () => {
      const { createPaymentToken, verifyPaymentToken } = await import('../token');
      
      const payload = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        treasuryAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        requiredAmountWei: '100000000000000',
        chainId: 8453,
        expiresAt: Date.now() - 1000, // Expired
        nonce: 'expired-nonce',
      };
      
      const token = createPaymentToken(payload);
      const result = verifyPaymentToken(token);
      
      expect(result.payload).toBeNull();
      expect(result.code).toBe('EXPIRED');
    });

    it('should reject tampered token with error info', async () => {
      const { createPaymentToken, verifyPaymentToken } = await import('../token');
      
      const payload = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        treasuryAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        requiredAmountWei: '100000000000000',
        chainId: 8453,
        expiresAt: Date.now() + 600000,
        nonce: 'test-nonce',
      };
      
      const token = createPaymentToken(payload);
      const [payloadPart] = token.split('.');
      const tamperedToken = `${payloadPart}.invalid-signature`;
      
      const result = verifyPaymentToken(tamperedToken);
      
      expect(result.payload).toBeNull();
      expect(result.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject malformed token', async () => {
      const { verifyPaymentToken } = await import('../token');
      
      expect(verifyPaymentToken('').payload).toBeNull();
      expect(verifyPaymentToken('not-a-token').code).toBe('INVALID_FORMAT');
      expect(verifyPaymentToken('too.many.parts.here').code).toBe('INVALID_FORMAT');
    });
  });

  describe('generateNonce', () => {
    it('should generate unique nonces', async () => {
      const { generateNonce } = await import('../token');
      
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toMatch(/^\d+_[a-f0-9]+$/);
    });
  });

  describe('validateTokenConfig', () => {
    it('should fail in production without secret', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.PAYMENT_TOKEN_SECRET;
      
      const { validateTokenConfig } = await import('../token');
      const result = validateTokenConfig();
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('PAYMENT_TOKEN_SECRET');
    });

    it('should pass in development without secret', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.PAYMENT_TOKEN_SECRET;
      
      const { validateTokenConfig } = await import('../token');
      const result = validateTokenConfig();
      
      expect(result.valid).toBe(true);
    });

    it('should pass in production with secret', async () => {
      process.env.NODE_ENV = 'production';
      process.env.PAYMENT_TOKEN_SECRET = 'my-production-secret';
      
      const { validateTokenConfig } = await import('../token');
      const result = validateTokenConfig();
      
      expect(result.valid).toBe(true);
    });
  });
});
