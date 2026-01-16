// Base mainnet chain configuration
export const BASE_CHAIN_ID = 8453;
export const BASE_CHAIN_ID_HEX = '0x2105';

// Payment configuration
// £0.0003 worth of ETH with 5% safety buffer
export const PAYMENT_AMOUNT_GBP = 0.0003;
export const SAFETY_BUFFER_PERCENT = 5;

// Intent TTL in milliseconds (10 minutes)
export const INTENT_TTL_MS = 10 * 60 * 1000;

// Minimum confirmations required
export const MIN_CONFIRMATIONS = 1;

// Fallback ETH/GBP rate if price feed fails (conservative estimate)
// This should be updated periodically as a safety net
export const FALLBACK_ETH_GBP_RATE = 2000; // £2000 per ETH
