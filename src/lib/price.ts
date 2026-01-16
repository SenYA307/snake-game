import { FALLBACK_ETH_GBP_RATE, SAFETY_BUFFER_PERCENT } from './constants';

interface PriceResult {
  ethPriceGbp: number;
  isFallback: boolean;
}

/**
 * Fetches current ETH/GBP price from CoinGecko (free API)
 * Falls back to static rate if API fails
 */
export async function getEthGbpPrice(): Promise<PriceResult> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=gbp',
      { 
        next: { revalidate: 60 }, // Cache for 60 seconds
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }
    );
    
    if (!response.ok) {
      throw new Error(`Price API returned ${response.status}`);
    }
    
    const data = await response.json();
    const ethPriceGbp = data?.ethereum?.gbp;
    
    if (typeof ethPriceGbp !== 'number' || ethPriceGbp <= 0) {
      throw new Error('Invalid price data');
    }
    
    return { ethPriceGbp, isFallback: false };
  } catch (error) {
    console.error('Price feed error, using fallback:', error);
    return { ethPriceGbp: FALLBACK_ETH_GBP_RATE, isFallback: true };
  }
}

/**
 * Converts GBP amount to Wei with safety buffer
 */
export function gbpToWei(gbpAmount: number, ethPriceGbp: number): bigint {
  // Add safety buffer to ensure payment covers the required amount
  const bufferedAmount = gbpAmount * (1 + SAFETY_BUFFER_PERCENT / 100);
  
  // Convert to ETH
  const ethAmount = bufferedAmount / ethPriceGbp;
  
  // Convert to Wei (1 ETH = 10^18 Wei)
  const weiAmount = BigInt(Math.ceil(ethAmount * 1e18));
  
  return weiAmount;
}
