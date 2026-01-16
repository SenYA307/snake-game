/**
 * Server-side configuration with validation.
 * 
 * This module validates all required environment variables at import time.
 * If any required env var is missing or invalid, it logs a clear error.
 * 
 * IMPORTANT: Only import this file in server-side code (API routes).
 */

import { isAddress, getAddress } from 'viem';
import { validateTokenConfig } from './token';

export interface ServerConfig {
  treasuryAddress: `0x${string}`;
  baseRpcUrl: string;
  isValid: boolean;
  errors: string[];
}

function validateConfig(): ServerConfig {
  const errors: string[] = [];
  
  // Validate TREASURY_ADDRESS
  const rawTreasuryAddress = process.env.TREASURY_ADDRESS?.trim();
  let treasuryAddress: `0x${string}` = '0x0000000000000000000000000000000000000000';
  
  if (!rawTreasuryAddress) {
    errors.push('TREASURY_ADDRESS env var is missing. Set it in .env.local');
  } else if (!isAddress(rawTreasuryAddress)) {
    errors.push(`TREASURY_ADDRESS is not a valid Ethereum address: "${rawTreasuryAddress}"`);
  } else {
    try {
      treasuryAddress = getAddress(rawTreasuryAddress) as `0x${string}`;
    } catch (e) {
      errors.push(`TREASURY_ADDRESS checksum validation failed: "${rawTreasuryAddress}"`);
    }
  }
  
  // Validate BASE_RPC_URL
  const baseRpcUrl = process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  
  if (!baseRpcUrl.startsWith('http://') && !baseRpcUrl.startsWith('https://')) {
    errors.push(`BASE_RPC_URL must be a valid URL: "${baseRpcUrl}"`);
  }
  
  // Validate token signing configuration
  const tokenConfig = validateTokenConfig();
  if (!tokenConfig.valid && tokenConfig.error) {
    errors.push(tokenConfig.error);
  }

  // Log errors at startup
  if (errors.length > 0) {
    console.error('\n========================================');
    console.error('⚠️  SERVER CONFIGURATION ERRORS:');
    errors.forEach((err, i) => console.error(`   ${i + 1}. ${err}`));
    console.error('========================================\n');
  } else {
    console.log('✅ Server config validated successfully');
    console.log(`   Treasury: ${treasuryAddress}`);
    console.log(`   RPC URL: ${baseRpcUrl}`);
  }
  
  return {
    treasuryAddress,
    baseRpcUrl,
    isValid: errors.length === 0,
    errors,
  };
}

// Validate on module load (happens once at server startup)
export const serverConfig = validateConfig();

/**
 * Get validated config or throw with helpful message.
 * Use this in API routes to ensure config is valid before processing.
 */
export function getValidatedConfig(): Omit<ServerConfig, 'isValid' | 'errors'> {
  if (!serverConfig.isValid) {
    throw new ConfigurationError(serverConfig.errors);
  }
  return {
    treasuryAddress: serverConfig.treasuryAddress,
    baseRpcUrl: serverConfig.baseRpcUrl,
  };
}

/**
 * Custom error class for configuration issues.
 */
export class ConfigurationError extends Error {
  public readonly errors: string[];
  public readonly isConfigError = true;
  
  constructor(errors: string[]) {
    super(`Server configuration error: ${errors.join('; ')}`);
    this.name = 'ConfigurationError';
    this.errors = errors;
  }
}
