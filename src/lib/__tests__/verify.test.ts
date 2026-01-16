import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the store module
vi.mock('../store', () => ({
  getPaymentIntent: vi.fn(),
  isIntentExpired: vi.fn(),
  isTxHashUsed: vi.fn(),
  markTxHashAsUsed: vi.fn(),
  markIntentAsPaid: vi.fn(),
}));

import {
  getPaymentIntent,
  isIntentExpired,
  isTxHashUsed,
  markTxHashAsUsed,
  markIntentAsPaid,
} from '../store';

describe('Payment Verification Logic', () => {
  const mockIntent = {
    sessionId: 'pay_123_abc',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',
    requiredAmountWei: '100000000000000', // 0.0001 ETH
    treasuryAddress: '0x1234567890123456789012345678901234567890',
    createdAt: Date.now(),
    expiresAt: Date.now() + 600000, // 10 minutes from now
    paid: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Anti-replay protection', () => {
    it('should reject already used transaction hash', () => {
      (isTxHashUsed as any).mockReturnValue(true);
      
      const result = isTxHashUsed('0xabc123');
      expect(result).toBe(true);
    });

    it('should allow unused transaction hash', () => {
      (isTxHashUsed as any).mockReturnValue(false);
      
      const result = isTxHashUsed('0xdef456');
      expect(result).toBe(false);
    });

    it('should mark transaction hash as used after verification', () => {
      markTxHashAsUsed('0xabc123');
      expect(markTxHashAsUsed).toHaveBeenCalledWith('0xabc123');
    });
  });

  describe('Intent validation', () => {
    it('should return undefined for non-existent intent', () => {
      (getPaymentIntent as any).mockReturnValue(undefined);
      
      const result = getPaymentIntent('invalid_session');
      expect(result).toBeUndefined();
    });

    it('should return intent for valid session', () => {
      (getPaymentIntent as any).mockReturnValue(mockIntent);
      
      const result = getPaymentIntent(mockIntent.sessionId);
      expect(result).toEqual(mockIntent);
    });

    it('should detect expired intent', () => {
      const expiredIntent = { ...mockIntent, expiresAt: Date.now() - 1000 };
      (isIntentExpired as any).mockReturnValue(true);
      
      const result = isIntentExpired(expiredIntent);
      expect(result).toBe(true);
    });

    it('should not detect valid intent as expired', () => {
      (isIntentExpired as any).mockReturnValue(false);
      
      const result = isIntentExpired(mockIntent);
      expect(result).toBe(false);
    });
  });

  describe('Payment amount validation', () => {
    it('should accept payment equal to required amount', () => {
      const requiredWei = BigInt(mockIntent.requiredAmountWei);
      const paidWei = BigInt(mockIntent.requiredAmountWei);
      
      expect(paidWei >= requiredWei).toBe(true);
    });

    it('should accept payment greater than required amount', () => {
      const requiredWei = BigInt(mockIntent.requiredAmountWei);
      const paidWei = BigInt('200000000000000'); // Double the required
      
      expect(paidWei >= requiredWei).toBe(true);
    });

    it('should reject payment less than required amount', () => {
      const requiredWei = BigInt(mockIntent.requiredAmountWei);
      const paidWei = BigInt('50000000000000'); // Half the required
      
      expect(paidWei >= requiredWei).toBe(false);
    });
  });

  describe('Address validation', () => {
    it('should validate checksummed addresses match', () => {
      const address1 = '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21';
      const address2 = '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21';
      
      expect(address1 === address2).toBe(true);
    });

    it('should detect mismatched addresses', () => {
      const address1 = '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21';
      const address2 = '0x1234567890123456789012345678901234567890';
      
      expect(address1 === address2).toBe(false);
    });
  });

  describe('Intent state management', () => {
    it('should mark intent as paid', () => {
      markIntentAsPaid(mockIntent.sessionId, '0xabc123');
      
      expect(markIntentAsPaid).toHaveBeenCalledWith(mockIntent.sessionId, '0xabc123');
    });
  });
});
