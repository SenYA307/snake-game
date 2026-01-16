import { NextRequest, NextResponse } from 'next/server';
import { isAddress, getAddress } from 'viem';
import { getEthGbpPrice, gbpToWei } from '@/lib/price';
import { PAYMENT_AMOUNT_GBP, INTENT_TTL_MS, BASE_CHAIN_ID } from '@/lib/constants';
import { getValidatedConfig, ConfigurationError, serverConfig } from '@/lib/config';
import { createPaymentToken, generateNonce } from '@/lib/token';

/**
 * POST /api/payments/create-intent
 * 
 * Creates a new payment intent with a SIGNED TOKEN.
 * 
 * The token is stateless and self-contained - it includes all data needed
 * for verification, signed with HMAC. This eliminates "intent not found"
 * errors caused by server restarts or hot reloads.
 * 
 * Request body: { walletAddress: string }
 * Response: { token, requiredAmountWei, treasuryAddress, ethAmount, gbpAmount, isFallbackPrice, expiresAt }
 */
export async function POST(request: NextRequest) {
  try {
    // === CONFIGURATION VALIDATION ===
    let config;
    try {
      config = getValidatedConfig();
    } catch (error) {
      if (error instanceof ConfigurationError) {
        console.error('Payment intent failed - configuration error:', error.errors);
        return NextResponse.json(
          { 
            error: 'Payment service is not configured. Please contact the administrator.',
            code: 'CONFIG_ERROR',
            hint: 'Check server logs for configuration details'
          },
          { status: 503 }
        );
      }
      throw error;
    }

    const body = await request.json();
    const { walletAddress } = body;

    // Validate wallet address
    if (!walletAddress || !isAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address', code: 'INVALID_ADDRESS' },
        { status: 400 }
      );
    }

    const checksummedWallet = getAddress(walletAddress);

    // Fetch current ETH/GBP price
    const { ethPriceGbp, isFallback } = await getEthGbpPrice();
    
    // Calculate required amount in Wei with safety buffer
    const requiredAmountWei = gbpToWei(PAYMENT_AMOUNT_GBP, ethPriceGbp);
    
    // Calculate expiry time
    const expiresAt = Date.now() + INTENT_TTL_MS;

    // Generate nonce for uniqueness
    const nonce = generateNonce();

    // Create a SIGNED TOKEN containing all verification data
    // This token is stateless - no server-side storage needed
    const token = createPaymentToken({
      walletAddress: checksummedWallet,
      treasuryAddress: config.treasuryAddress,
      requiredAmountWei: requiredAmountWei.toString(),
      chainId: BASE_CHAIN_ID,
      expiresAt,
      nonce,
    });

    // Calculate ETH amount for display
    const ethAmount = Number(requiredAmountWei) / 1e18;

    console.log(`Payment intent created: wallet=${checksummedWallet}, amount=${ethAmount} ETH, nonce=${nonce}`);

    return NextResponse.json({
      // The signed token - frontend MUST send this to /verify
      token,
      // Display data
      requiredAmountWei: requiredAmountWei.toString(),
      treasuryAddress: config.treasuryAddress,
      ethAmount: ethAmount.toFixed(8),
      gbpAmount: PAYMENT_AMOUNT_GBP,
      isFallbackPrice: isFallback,
      expiresAt,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/create-intent
 * 
 * Health check endpoint - returns config status.
 */
export async function GET() {
  return NextResponse.json({
    status: serverConfig.isValid ? 'ready' : 'misconfigured',
    configured: serverConfig.isValid,
    errorCount: serverConfig.errors.length,
    message: serverConfig.isValid 
      ? 'Payment service is ready' 
      : 'Payment service is misconfigured. Check server logs.',
  });
}
