import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Server Configuration Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('TREASURY_ADDRESS validation', () => {
    it('should accept valid checksummed address', async () => {
      process.env.TREASURY_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      process.env.BASE_RPC_URL = 'https://mainnet.base.org';
      
      const { serverConfig } = await import('../config');
      
      expect(serverConfig.isValid).toBe(true);
      expect(serverConfig.errors).toHaveLength(0);
      expect(serverConfig.treasuryAddress).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    });

    it('should reject missing TREASURY_ADDRESS', async () => {
      delete process.env.TREASURY_ADDRESS;
      process.env.BASE_RPC_URL = 'https://mainnet.base.org';
      
      const { serverConfig } = await import('../config');
      
      expect(serverConfig.isValid).toBe(false);
      expect(serverConfig.errors.some(e => e.includes('TREASURY_ADDRESS'))).toBe(true);
    });

    it('should reject invalid address format', async () => {
      process.env.TREASURY_ADDRESS = 'not-an-address';
      process.env.BASE_RPC_URL = 'https://mainnet.base.org';
      
      const { serverConfig } = await import('../config');
      
      expect(serverConfig.isValid).toBe(false);
      expect(serverConfig.errors.some(e => e.includes('not a valid Ethereum address'))).toBe(true);
    });

    it('should trim whitespace from address', async () => {
      process.env.TREASURY_ADDRESS = '  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045  ';
      process.env.BASE_RPC_URL = 'https://mainnet.base.org';
      
      const { serverConfig } = await import('../config');
      
      expect(serverConfig.isValid).toBe(true);
      expect(serverConfig.treasuryAddress).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    });
  });

  describe('BASE_RPC_URL validation', () => {
    it('should use default RPC URL if not provided', async () => {
      process.env.TREASURY_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      delete process.env.BASE_RPC_URL;
      
      const { serverConfig } = await import('../config');
      
      expect(serverConfig.baseRpcUrl).toBe('https://mainnet.base.org');
    });

    it('should accept valid HTTPS URL', async () => {
      process.env.TREASURY_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      process.env.BASE_RPC_URL = 'https://base-mainnet.g.alchemy.com/v2/key';
      
      const { serverConfig } = await import('../config');
      
      expect(serverConfig.isValid).toBe(true);
      expect(serverConfig.baseRpcUrl).toBe('https://base-mainnet.g.alchemy.com/v2/key');
    });

    it('should reject invalid URL format', async () => {
      process.env.TREASURY_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      process.env.BASE_RPC_URL = 'not-a-url';
      
      const { serverConfig } = await import('../config');
      
      expect(serverConfig.isValid).toBe(false);
      expect(serverConfig.errors.some(e => e.includes('BASE_RPC_URL'))).toBe(true);
    });
  });

  describe('ConfigurationError', () => {
    it('should throw when getting config with invalid setup', async () => {
      delete process.env.TREASURY_ADDRESS;
      
      const { getValidatedConfig, ConfigurationError } = await import('../config');
      
      expect(() => getValidatedConfig()).toThrow(ConfigurationError);
    });

    it('should return config when valid', async () => {
      process.env.TREASURY_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      process.env.BASE_RPC_URL = 'https://mainnet.base.org';
      
      const { getValidatedConfig } = await import('../config');
      
      const config = getValidatedConfig();
      expect(config.treasuryAddress).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
      expect(config.baseRpcUrl).toBe('https://mainnet.base.org');
    });
  });
});
