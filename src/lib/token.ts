/**
 * Stateless Payment Token System
 * 
 * Instead of storing payment intents in memory (which gets lost on hot reload),
 * we create a cryptographically signed token containing all verification data.
 * 
 * The token is:
 * - Self-contained: includes all data needed for verification
 * - Tamper-proof: signed with HMAC-SHA256
 * - Expirable: includes expiresAt timestamp
 * - Stateless: server doesn't need to remember anything
 */

import { createHmac, randomBytes } from 'crypto';

export interface PaymentTokenPayload {
  walletAddress: string;
  treasuryAddress: string;
  requiredAmountWei: string;
  chainId: number;
  expiresAt: number;
  nonce: string;
}

// Cache the signing secret to ensure consistency and avoid repeated warnings
let cachedSecret: string | null = null;
let secretWarningShown = false;

/**
 * Get the signing secret from environment.
 * Caches the result to ensure consistency across hot reloads.
 */
function getSigningSecret(): string {
  // Return cached secret if available
  if (cachedSecret) {
    return cachedSecret;
  }

  const secret = process.env.PAYMENT_TOKEN_SECRET;
  
  if (secret) {
    cachedSecret = secret;
    console.log('✅ Payment token secret configured');
    return cachedSecret;
  }
  
  // Development fallback - generate a stable secret based on treasury address
  // This ensures tokens remain valid across the same dev session
  const treasuryAddress = process.env.TREASURY_ADDRESS || 'default';
  cachedSecret = `dev-secret-${treasuryAddress}-${process.pid}`;
  
  // Only show warning once
  if (!secretWarningShown) {
    secretWarningShown = true;
    console.warn('');
    console.warn('⚠️  PAYMENT_TOKEN_SECRET not set');
    console.warn('   Using development fallback (NOT SECURE FOR PRODUCTION)');
    console.warn('   Set PAYMENT_TOKEN_SECRET in .env.local for production');
    console.warn('   Generate with: openssl rand -hex 32');
    console.warn('');
  }
  
  return cachedSecret;
}

/**
 * Check if we're in production and secret is not set.
 * Call this at startup to fail fast.
 */
export function validateTokenConfig(): { valid: boolean; error?: string } {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasSecret = !!process.env.PAYMENT_TOKEN_SECRET;
  
  if (isProduction && !hasSecret) {
    return {
      valid: false,
      error: 'PAYMENT_TOKEN_SECRET must be set in production',
    };
  }
  
  // Initialize the cached secret
  getSigningSecret();
  
  return { valid: true };
}

/**
 * Create a signed payment token.
 */
export function createPaymentToken(payload: PaymentTokenPayload): string {
  const secret = getSigningSecret();
  
  // Encode payload as base64
  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson).toString('base64url');
  
  // Create HMAC signature
  const signature = createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');
  
  // Return token as payload.signature
  return `${payloadBase64}.${signature}`;
}

/**
 * Verify and decode a payment token.
 * Returns the payload if valid, or an error object if invalid.
 */
export function verifyPaymentToken(token: string): { 
  payload: PaymentTokenPayload | null; 
  error?: string;
  code?: string;
} {
  try {
    const secret = getSigningSecret();
    
    // Split token into payload and signature
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { payload: null, error: 'Invalid token format', code: 'INVALID_FORMAT' };
    }
    
    const [payloadBase64, providedSignature] = parts;
    
    // Verify signature
    const expectedSignature = createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64url');
    
    if (providedSignature !== expectedSignature) {
      return { payload: null, error: 'Invalid token signature', code: 'INVALID_SIGNATURE' };
    }
    
    // Decode payload
    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload: PaymentTokenPayload = JSON.parse(payloadJson);
    
    // Check expiry
    if (Date.now() > payload.expiresAt) {
      return { payload: null, error: 'Token expired', code: 'EXPIRED' };
    }
    
    return { payload };
  } catch (error) {
    console.error('Token verification error:', error);
    return { payload: null, error: 'Token verification failed', code: 'VERIFICATION_ERROR' };
  }
}

/**
 * Generate a random nonce for the token.
 */
export function generateNonce(): string {
  return `${Date.now()}_${randomBytes(8).toString('hex')}`;
}
