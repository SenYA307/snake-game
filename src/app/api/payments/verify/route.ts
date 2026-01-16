import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress, getAddress } from 'viem';
import { base } from 'viem/chains';
import { isTxHashUsed, markTxHashAsUsed } from '@/lib/store';
import { BASE_CHAIN_ID, MIN_CONFIRMATIONS } from '@/lib/constants';
import { getValidatedConfig, ConfigurationError } from '@/lib/config';
import { verifyPaymentToken } from '@/lib/token';

/**
 * POST /api/payments/verify
 * 
 * Verifies a payment transaction on Base mainnet using a STATELESS TOKEN.
 * 
 * The token (from create-intent) contains all verification parameters,
 * signed with HMAC. This eliminates "intent not found" errors.
 * 
 * Request body: { txHash: string, token: string, walletAddress: string }
 * Response: { paid: boolean, error?: string, code?: string, retryable?: boolean }
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 8);
  const log = (msg: string) => console.log(`[verify:${requestId}] ${msg}`);
  const logError = (msg: string) => console.error(`[verify:${requestId}] ${msg}`);

  try {
    // === CONFIGURATION VALIDATION ===
    let config;
    try {
      config = getValidatedConfig();
    } catch (error) {
      if (error instanceof ConfigurationError) {
        logError(`Configuration error: ${error.errors.join(', ')}`);
        return NextResponse.json(
          { 
            paid: false, 
            error: 'Payment service is not configured.',
            code: 'CONFIG_ERROR',
            retryable: false,
          },
          { status: 503 }
        );
      }
      throw error;
    }

    // Create a viem client for Base mainnet
    const baseClient = createPublicClient({
      chain: base,
      transport: http(config.baseRpcUrl),
    });

    const body = await request.json();
    const { txHash, token, walletAddress } = body;

    log(`Verifying: txHash=${txHash?.substring(0, 10)}..., wallet=${walletAddress?.substring(0, 10)}...`);

    // === Input Validation ===
    if (!txHash || typeof txHash !== 'string' || !txHash.startsWith('0x')) {
      logError('Invalid txHash format');
      return NextResponse.json(
        { paid: false, error: 'Invalid transaction hash', code: 'INVALID_TX_HASH', retryable: false },
        { status: 400 }
      );
    }

    if (!token || typeof token !== 'string') {
      logError('Missing token');
      return NextResponse.json(
        { paid: false, error: 'Missing payment token. Please start a new payment.', code: 'MISSING_TOKEN', retryable: false },
        { status: 400 }
      );
    }

    if (!walletAddress || !isAddress(walletAddress)) {
      logError('Invalid wallet address');
      return NextResponse.json(
        { paid: false, error: 'Invalid wallet address', code: 'INVALID_ADDRESS', retryable: false },
        { status: 400 }
      );
    }

    // === Anti-Replay Check (check FIRST to give helpful message) ===
    if (isTxHashUsed(txHash)) {
      log('TxHash already used - payment was already verified successfully');
      // This means the payment was already verified!
      // Return success so the frontend can proceed
      return NextResponse.json({
        paid: true,
        message: 'Payment was already verified',
        code: 'ALREADY_VERIFIED',
      });
    }

    // === TOKEN VERIFICATION ===
    const tokenResult = verifyPaymentToken(token);
    
    if (!tokenResult.payload) {
      logError(`Token verification failed: ${tokenResult.code} - ${tokenResult.error}`);
      return NextResponse.json(
        { 
          paid: false, 
          error: tokenResult.code === 'EXPIRED' 
            ? 'Payment session expired. Please start a new payment.'
            : 'Invalid payment token. Please start a new payment.',
          code: tokenResult.code === 'EXPIRED' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          retryable: false,
        },
        { status: 400 }
      );
    }

    const tokenPayload = tokenResult.payload;

    // Verify wallet address matches the token
    if (getAddress(walletAddress) !== tokenPayload.walletAddress) {
      logError(`Wallet mismatch: expected ${tokenPayload.walletAddress}, got ${walletAddress}`);
      return NextResponse.json(
        { paid: false, error: 'Wallet address mismatch', code: 'ADDRESS_MISMATCH', retryable: false },
        { status: 400 }
      );
    }

    // Verify chain ID in token
    if (tokenPayload.chainId !== BASE_CHAIN_ID) {
      logError(`Chain mismatch: expected ${BASE_CHAIN_ID}, got ${tokenPayload.chainId}`);
      return NextResponse.json(
        { paid: false, error: 'Invalid chain in token', code: 'WRONG_CHAIN', retryable: false },
        { status: 400 }
      );
    }

    // === Fetch Transaction Receipt from Base RPC ===
    let receipt;
    let transaction;
    
    try {
      [receipt, transaction] = await Promise.all([
        baseClient.getTransactionReceipt({ hash: txHash as `0x${string}` }),
        baseClient.getTransaction({ hash: txHash as `0x${string}` }),
      ]);
    } catch (error) {
      logError(`Failed to fetch tx from RPC: ${error}`);
      return NextResponse.json(
        { 
          paid: false, 
          error: 'Transaction not found yet. It may still be confirming.',
          code: 'TX_NOT_FOUND',
          retryable: true, // Frontend should auto-retry
        },
        { status: 400 }
      );
    }

    // === Verification Checks ===
    
    // 1. Check transaction status
    if (receipt.status !== 'success') {
      logError(`Transaction failed on-chain: ${txHash}`);
      return NextResponse.json(
        { paid: false, error: 'Transaction failed on-chain', code: 'TX_FAILED', retryable: false },
        { status: 400 }
      );
    }

    // 2. Check recipient address
    if (!transaction.to || getAddress(transaction.to) !== tokenPayload.treasuryAddress) {
      logError(`Wrong recipient: expected ${tokenPayload.treasuryAddress}, got ${transaction.to}`);
      return NextResponse.json(
        { paid: false, error: 'Payment sent to wrong address', code: 'WRONG_RECIPIENT', retryable: false },
        { status: 400 }
      );
    }

    // 3. Check sender address
    if (getAddress(transaction.from) !== tokenPayload.walletAddress) {
      logError(`Wrong sender: expected ${tokenPayload.walletAddress}, got ${transaction.from}`);
      return NextResponse.json(
        { paid: false, error: 'Transaction from wrong wallet', code: 'WRONG_SENDER', retryable: false },
        { status: 400 }
      );
    }

    // 4. Check payment amount
    const requiredAmountWei = BigInt(tokenPayload.requiredAmountWei);
    if (transaction.value < requiredAmountWei) {
      logError(`Insufficient amount: required ${requiredAmountWei}, got ${transaction.value}`);
      return NextResponse.json(
        { paid: false, error: 'Insufficient payment amount', code: 'INSUFFICIENT_AMOUNT', retryable: false },
        { status: 400 }
      );
    }

    // 5. Check confirmations
    const currentBlock = await baseClient.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1n;
    
    if (confirmations < MIN_CONFIRMATIONS) {
      log(`Waiting for confirmations: ${confirmations}/${MIN_CONFIRMATIONS}`);
      return NextResponse.json(
        { 
          paid: false, 
          error: 'Waiting for blockchain confirmation...',
          code: 'PENDING_CONFIRMATIONS',
          retryable: true, // Frontend should auto-retry
          confirmations: Number(confirmations),
          required: MIN_CONFIRMATIONS,
        },
        { status: 400 }
      );
    }

    // === All Checks Passed - Mark txHash as Used ===
    markTxHashAsUsed(txHash);

    log(`✅ Payment verified: wallet=${tokenPayload.walletAddress}, confirmations=${confirmations}`);

    return NextResponse.json({
      paid: true,
      message: 'Payment verified successfully',
      confirmations: Number(confirmations),
    });
  } catch (error) {
    logError(`Unexpected error: ${error}`);
    return NextResponse.json(
      { paid: false, error: 'Failed to verify payment', code: 'INTERNAL_ERROR', retryable: true },
      { status: 500 }
    );
  }
}
