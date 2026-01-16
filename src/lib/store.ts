/**
 * Anti-replay storage for used transaction hashes.
 * 
 * SERVERLESS LIMITATION:
 * In serverless environments (like Vercel), this in-memory Set resets between
 * invocations. This means a txHash COULD potentially be replayed across different
 * serverless instances.
 * 
 * MITIGATION:
 * 1. Each payment token has a unique nonce and 10-minute expiry
 * 2. The token can only be used with its matching transaction
 * 3. For a replay attack, someone would need the original token AND make a new tx
 * 
 * FOR PRODUCTION AT SCALE:
 * Replace this with Vercel KV, Upstash Redis, or a database:
 *   - Vercel KV: https://vercel.com/docs/storage/vercel-kv
 *   - Upstash: https://upstash.com/
 * 
 * The interface would remain the same, just change the implementation.
 */

// In-memory set of used transaction hashes
// Persists within a single serverless instance's lifecycle
const usedTxHashes = new Set<string>();

// Track when this instance was created (for debugging)
const instanceId = Math.random().toString(36).substring(2, 8);
const instanceCreatedAt = new Date().toISOString();

/**
 * Check if a transaction hash has already been used.
 */
export function isTxHashUsed(txHash: string): boolean {
  const normalized = txHash.toLowerCase();
  const isUsed = usedTxHashes.has(normalized);
  
  if (isUsed) {
    console.log(`[store:${instanceId}] TxHash already used: ${txHash.substring(0, 18)}...`);
  }
  
  return isUsed;
}

/**
 * Mark a transaction hash as used (after successful verification).
 */
export function markTxHashAsUsed(txHash: string): void {
  const normalized = txHash.toLowerCase();
  usedTxHashes.add(normalized);
  
  console.log(`[store:${instanceId}] Marked txHash as used: ${txHash.substring(0, 18)}... (total in instance: ${usedTxHashes.size})`);
}

/**
 * Get count of used transaction hashes (for monitoring).
 */
export function getUsedTxCount(): number {
  return usedTxHashes.size;
}

/**
 * Get store instance info (for debugging).
 */
export function getStoreInfo(): { instanceId: string; createdAt: string; txCount: number } {
  return {
    instanceId,
    createdAt: instanceCreatedAt,
    txCount: usedTxHashes.size,
  };
}
