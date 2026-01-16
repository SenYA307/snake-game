'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { BASE_CHAIN_ID } from '@/lib/constants';

// Payment flow states
type PaymentState =
  | 'idle'
  | 'loading_quote'
  | 'quote_ready'
  | 'awaiting_signature'
  | 'tx_pending'
  | 'verifying'
  | 'confirmed'
  | 'failed';

interface PaymentIntent {
  token: string;
  requiredAmountWei: string;
  treasuryAddress: string;
  ethAmount: string;
  gbpAmount: number;
  isFallbackPrice: boolean;
  expiresAt: number;
}

interface PaymentGateProps {
  onPaymentConfirmed: () => void;
  isReplay?: boolean;
}

// Max retry attempts for verification
const MAX_VERIFY_RETRIES = 10;
const VERIFY_RETRY_DELAY_MS = 2000;

/**
 * PaymentGate Component
 * 
 * Enforces the pay-to-play flow:
 * 1. Connect wallet
 * 2. Switch to Base network
 * 3. Pay entry fee in ETH
 * 
 * Game is blocked until payment is verified by backend.
 */
export function PaymentGate({ onPaymentConfirmed, isReplay = false }: PaymentGateProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [verifyRetries, setVerifyRetries] = useState(0);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  
  // Track if we need a completely new payment (vs just retry verification)
  const [needsNewPayment, setNeedsNewPayment] = useState(false);

  const isOnBase = chainId === BASE_CHAIN_ID;
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when component mounts (fresh payment flow)
  useEffect(() => {
    setPaymentState('idle');
    setIntent(null);
    setError(null);
    setTxHash(undefined);
    setVerifyRetries(0);
    setIsAutoRetrying(false);
    setNeedsNewPayment(false);
    
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Transaction hooks
  const { sendTransaction, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Fetch payment quote from backend
  const fetchQuote = useCallback(async () => {
    if (!address) return;
    
    setPaymentState('loading_quote');
    setError(null);
    setNeedsNewPayment(false);

    try {
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorCode = data.code;
        let userMessage = data.error || 'Failed to get quote';
        
        if (errorCode === 'CONFIG_ERROR') {
          userMessage = 'Payment service unavailable. Please try again later.';
          console.error('Server configuration error. Check server logs.');
        }
        
        throw new Error(userMessage);
      }

      setIntent(data);
      setPaymentState('quote_ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quote');
      setPaymentState('failed');
    }
  }, [address]);

  // Auto-fetch quote when connected to Base
  useEffect(() => {
    if (isConnected && isOnBase && paymentState === 'idle') {
      fetchQuote();
    }
  }, [isConnected, isOnBase, paymentState, fetchQuote]);

  // Handle payment
  const handlePayment = async () => {
    if (!intent || !address) return;

    setPaymentState('awaiting_signature');
    setError(null);
    setVerifyRetries(0);

    try {
      sendTransaction(
        {
          to: intent.treasuryAddress as `0x${string}`,
          value: BigInt(intent.requiredAmountWei),
        },
        {
          onSuccess: (hash) => {
            console.log('Transaction sent:', hash);
            setTxHash(hash);
            setPaymentState('tx_pending');
          },
          onError: (err) => {
            setError(err.message || 'Transaction failed');
            setPaymentState('failed');
            setNeedsNewPayment(true);
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setPaymentState('failed');
      setNeedsNewPayment(true);
    }
  };

  // Verify payment with backend
  const verifyPayment = useCallback(async (isRetry = false) => {
    if (!txHash || !intent?.token || !address) {
      console.error('Cannot verify: missing data');
      setError('Missing payment data.');
      setPaymentState('failed');
      setNeedsNewPayment(true);
      return;
    }

    if (!isRetry) {
      setPaymentState('verifying');
    }
    setIsAutoRetrying(isRetry);

    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          token: intent.token,
          walletAddress: address,
        }),
      });

      const data = await response.json();

      if (data.paid) {
        // Success! Payment verified
        console.log('Payment verified successfully');
        setPaymentState('confirmed');
        setIsAutoRetrying(false);
        onPaymentConfirmed();
        return;
      }

      // Handle different error codes
      const { code, retryable, error: errorMsg } = data;
      console.log('Verify response:', { code, retryable, error: errorMsg });

      if (retryable && verifyRetries < MAX_VERIFY_RETRIES) {
        // Auto-retry for retryable errors (pending confirmations, tx not found yet)
        console.log(`Auto-retrying verification in ${VERIFY_RETRY_DELAY_MS}ms (attempt ${verifyRetries + 1}/${MAX_VERIFY_RETRIES})`);
        setVerifyRetries(prev => prev + 1);
        
        retryTimeoutRef.current = setTimeout(() => {
          verifyPayment(true);
        }, VERIFY_RETRY_DELAY_MS);
        return;
      }

      // Non-retryable error or max retries reached
      setIsAutoRetrying(false);
      
      if (code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED' || code === 'MISSING_TOKEN') {
        setError('Payment session expired. Please make a new payment.');
        setNeedsNewPayment(true);
      } else if (code === 'TX_ALREADY_USED' || code === 'ALREADY_VERIFIED') {
        // This shouldn't happen in normal flow, but if it does, proceed
        console.log('Transaction was already verified');
        setPaymentState('confirmed');
        onPaymentConfirmed();
        return;
      } else if (verifyRetries >= MAX_VERIFY_RETRIES) {
        setError('Verification timed out. Please try again.');
        setNeedsNewPayment(false); // Can retry with same tx
      } else {
        setError(errorMsg || 'Payment verification failed');
        setNeedsNewPayment(!retryable);
      }
      
      setPaymentState('failed');
    } catch (err) {
      console.error('Verify fetch error:', err);
      setIsAutoRetrying(false);
      
      if (verifyRetries < MAX_VERIFY_RETRIES) {
        // Network error, retry
        setVerifyRetries(prev => prev + 1);
        retryTimeoutRef.current = setTimeout(() => {
          verifyPayment(true);
        }, VERIFY_RETRY_DELAY_MS);
      } else {
        setError('Network error. Please check your connection.');
        setPaymentState('failed');
        setNeedsNewPayment(false);
      }
    }
  }, [txHash, intent?.token, address, verifyRetries, onPaymentConfirmed]);

  // Start verification when tx is confirmed on-chain
  useEffect(() => {
    if (isConfirmed && txHash && intent && paymentState === 'tx_pending') {
      console.log('Transaction confirmed on-chain, starting verification');
      verifyPayment(false);
    }
  }, [isConfirmed, txHash, intent, paymentState, verifyPayment]);

  // Handle network switch
  const handleSwitchNetwork = () => {
    switchChain?.({ chainId: BASE_CHAIN_ID });
  };

  // Retry button handler
  const handleRetry = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    setError(null);
    setVerifyRetries(0);
    setIsAutoRetrying(false);
    
    if (needsNewPayment) {
      // Need completely new payment flow
      setTxHash(undefined);
      setIntent(null);
      setPaymentState('idle');
      setNeedsNewPayment(false);
    } else if (txHash && intent) {
      // Just retry verification with existing tx
      verifyPayment(false);
    } else {
      // No tx, start fresh
      setPaymentState('idle');
    }
  };

  // Check if quote is expired
  const isQuoteExpired = intent && Date.now() > intent.expiresAt;

  // Current step indicator
  const getCurrentStep = () => {
    if (!isConnected) return 1;
    if (!isOnBase) return 2;
    return 3;
  };

  const currentStep = getCurrentStep();

  return (
    <div className="payment-gate">
      <div className="payment-modal">
        <h2>🐍 PIXEL SNAKE</h2>
        <p className="subtitle">
          {isReplay ? 'Pay to Play Again' : 'Pay-to-Play'}
        </p>
        {isReplay && (
          <p className="replay-notice">Each run requires a new payment</p>
        )}

        {/* Progress Steps */}
        <div className="steps">
          <div className={`step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Connect Wallet</span>
          </div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Switch to Base</span>
          </div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''} ${paymentState === 'confirmed' ? 'completed' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Pay Entry Fee</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="step-content">
          {/* Step 1: Connect Wallet */}
          {!isConnected && (
            <div className="connect-section">
              <p>Connect your wallet to play</p>
              <ConnectButton />
            </div>
          )}

          {/* Step 2: Switch Network */}
          {isConnected && !isOnBase && (
            <div className="network-section">
              <p>Please switch to Base network</p>
              <button
                onClick={handleSwitchNetwork}
                disabled={isSwitching}
                className="action-btn"
              >
                {isSwitching ? 'Switching...' : 'Switch to Base'}
              </button>
            </div>
          )}

          {/* Step 3: Payment */}
          {isConnected && isOnBase && (
            <div className="payment-section">
              {/* Loading Quote */}
              {paymentState === 'loading_quote' && (
                <div className="loading">
                  <div className="spinner"></div>
                  <p>Fetching price...</p>
                </div>
              )}

              {/* Quote Ready */}
              {(paymentState === 'quote_ready' || paymentState === 'awaiting_signature') && intent && !isQuoteExpired && (
                <div className="quote">
                  <div className="amount-display">
                    <span className="eth-amount">{intent.ethAmount} ETH</span>
                    <span className="fiat-amount">≈ £{intent.gbpAmount.toFixed(4)}</span>
                  </div>
                  {intent.isFallbackPrice && (
                    <p className="warning">⚠️ Using estimated price</p>
                  )}
                  <button
                    onClick={handlePayment}
                    disabled={isSending || paymentState === 'awaiting_signature'}
                    className="action-btn pay-btn"
                  >
                    {paymentState === 'awaiting_signature' ? 'Confirm in Wallet...' : 'Pay to Play'}
                  </button>
                </div>
              )}

              {/* Quote Expired */}
              {isQuoteExpired && paymentState === 'quote_ready' && (
                <div className="expired">
                  <p>Quote expired</p>
                  <button onClick={handleRetry} className="action-btn">
                    Get New Quote
                  </button>
                </div>
              )}

              {/* Transaction Pending */}
              {paymentState === 'tx_pending' && (
                <div className="pending">
                  <div className="spinner"></div>
                  <p>Transaction confirming...</p>
                  {txHash && (
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View on BaseScan ↗
                    </a>
                  )}
                </div>
              )}

              {/* Verifying */}
              {paymentState === 'verifying' && (
                <div className="verifying">
                  <div className="spinner"></div>
                  <p>{isAutoRetrying ? `Confirming payment... (${verifyRetries}/${MAX_VERIFY_RETRIES})` : 'Verifying payment...'}</p>
                  {txHash && (
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View on BaseScan ↗
                    </a>
                  )}
                </div>
              )}

              {/* Confirmed */}
              {paymentState === 'confirmed' && (
                <div className="confirmed">
                  <span className="check">✓</span>
                  <p>Payment confirmed!</p>
                  <p className="starting">Starting game...</p>
                </div>
              )}

              {/* Failed */}
              {paymentState === 'failed' && (
                <div className="failed">
                  <p className="error-msg">{error || 'Payment failed'}</p>
                  <button onClick={handleRetry} className="action-btn">
                    {needsNewPayment ? 'Make New Payment' : 'Retry Verification'}
                  </button>
                  {txHash && !needsNewPayment && (
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View Transaction ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Connected Wallet Info */}
        {isConnected && (
          <div className="wallet-info">
            <ConnectButton.Custom>
              {({ account, chain, openAccountModal }) => (
                <button onClick={openAccountModal} className="wallet-btn">
                  {account?.displayName} {chain?.name && `(${chain.name})`}
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        )}
      </div>

      <style jsx>{`
        .payment-gate {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 10, 18, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .payment-modal {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 3px solid #00ff88;
          border-radius: 16px;
          padding: 40px;
          max-width: 420px;
          width: 90%;
          text-align: center;
          box-shadow: 0 0 40px rgba(0, 255, 136, 0.2);
        }

        h2 {
          font-size: 2rem;
          color: #00ff88;
          margin: 0 0 8px 0;
          text-shadow: 0 0 20px #00ff88;
        }

        .subtitle {
          color: #888;
          margin: 0 0 10px 0;
          font-size: 1.1rem;
        }

        .replay-notice {
          color: #ff6b6b;
          font-size: 0.9rem;
          margin: 0 0 25px 0;
          padding: 8px 16px;
          background: rgba(255, 107, 107, 0.1);
          border-radius: 4px;
        }

        .steps {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding: 0 10px;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0.4;
          transition: opacity 0.3s;
        }

        .step.active {
          opacity: 1;
        }

        .step.completed .step-number {
          background: #00ff88;
          color: #0a0a12;
        }

        .step-number {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid #00ff88;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }

        .step-label {
          font-size: 0.75rem;
          color: #888;
        }

        .step.active .step-label {
          color: #00ff88;
        }

        .step-content {
          min-height: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .connect-section,
        .network-section,
        .payment-section {
          width: 100%;
        }

        .connect-section p,
        .network-section p {
          margin-bottom: 20px;
          color: #ccc;
        }

        .action-btn {
          padding: 14px 32px;
          font-size: 1.1rem;
          font-weight: bold;
          background: transparent;
          border: 2px solid #00ff88;
          color: #00ff88;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover:not(:disabled) {
          background: #00ff88;
          color: #0a0a12;
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pay-btn {
          width: 100%;
          border-color: #ff6b6b;
          color: #ff6b6b;
        }

        .pay-btn:hover:not(:disabled) {
          background: #ff6b6b;
          color: #0a0a12;
        }

        .amount-display {
          margin-bottom: 20px;
        }

        .eth-amount {
          display: block;
          font-size: 1.8rem;
          color: #00ff88;
          font-weight: bold;
        }

        .fiat-amount {
          color: #888;
          font-size: 1rem;
        }

        .warning {
          color: #ffaa00;
          font-size: 0.85rem;
          margin-bottom: 15px;
        }

        .loading,
        .pending,
        .verifying {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0, 255, 136, 0.2);
          border-top-color: #00ff88;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .tx-link {
          color: #00ff88;
          text-decoration: none;
          font-size: 0.9rem;
          margin-top: 10px;
        }

        .tx-link:hover {
          text-decoration: underline;
        }

        .confirmed {
          color: #00ff88;
        }

        .check {
          font-size: 3rem;
          display: block;
          margin-bottom: 10px;
        }

        .starting {
          color: #888;
          font-size: 0.9rem;
        }

        .failed {
          color: #ff6b6b;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }

        .error-msg {
          font-size: 0.95rem;
          max-width: 300px;
        }

        .wallet-info {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .wallet-btn {
          background: transparent;
          border: 1px solid #444;
          color: #888;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
        }

        .wallet-btn:hover {
          border-color: #888;
          color: #ccc;
        }
      `}</style>
    </div>
  );
}
