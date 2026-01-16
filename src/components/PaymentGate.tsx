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
import { isAutopayDisabled, disableAutopay } from '@/lib/gameConstants';

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
  onDecline?: () => void;
  isReplay?: boolean;
}

const MAX_VERIFY_RETRIES = 10;
const VERIFY_RETRY_DELAY_MS = 2000;

// EIP-1193 error codes
const USER_REJECTED_CODE = 4001;

/**
 * Checks if an error is a user rejection (wallet cancel)
 */
function isUserRejection(error: unknown): boolean {
  if (!error) return false;
  
  // Check for EIP-1193 error code
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: number; cause?: { code?: number }; shortMessage?: string };
    if (err.code === USER_REJECTED_CODE) return true;
    if (err.cause?.code === USER_REJECTED_CODE) return true;
    if (err.shortMessage?.toLowerCase().includes('rejected')) return true;
    if (err.shortMessage?.toLowerCase().includes('denied')) return true;
  }
  
  // Check error message
  const message = String(error).toLowerCase();
  return message.includes('user rejected') || 
         message.includes('user denied') ||
         message.includes('rejected the request');
}

/**
 * PaymentGate Component
 * 
 * Enforces pay-to-play with auto-pay logic:
 * - On replay, tries to auto-initiate payment flow
 * - If user rejects once, auto-pay is disabled for that wallet
 */
export function PaymentGate({ onPaymentConfirmed, onDecline, isReplay = false }: PaymentGateProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [verifyRetries, setVerifyRetries] = useState(0);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [needsNewPayment, setNeedsNewPayment] = useState(false);
  const [wasRejected, setWasRejected] = useState(false);
  const [autopayDisabledMessage, setAutopayDisabledMessage] = useState(false);

  const isOnBase = chainId === BASE_CHAIN_ID;
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoPayAttempted = useRef(false);

  // Check if autopay is disabled for this wallet
  const autopayDisabled = address ? isAutopayDisabled(address) : false;

  // Reset state when component mounts
  useEffect(() => {
    setPaymentState('idle');
    setIntent(null);
    setError(null);
    setTxHash(undefined);
    setVerifyRetries(0);
    setIsAutoRetrying(false);
    setNeedsNewPayment(false);
    setWasRejected(false);
    autoPayAttempted.current = false;
    
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Transaction hooks
  const { sendTransaction, isPending: isSending, error: sendError } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Detect user rejection from send error
  useEffect(() => {
    if (sendError && isUserRejection(sendError)) {
      console.log('User rejected transaction');
      setWasRejected(true);
      if (address) {
        disableAutopay(address);
        setAutopayDisabledMessage(true);
      }
    }
  }, [sendError, address]);

  // Fetch payment quote
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
        }
        
        throw new Error(userMessage);
      }

      setIntent(data);
      setPaymentState('quote_ready');
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quote');
      setPaymentState('failed');
      return null;
    }
  }, [address]);

  // Auto-fetch quote when ready
  useEffect(() => {
    if (isConnected && isOnBase && paymentState === 'idle') {
      fetchQuote();
    }
  }, [isConnected, isOnBase, paymentState, fetchQuote]);

  // Handle payment
  const handlePayment = useCallback(async () => {
    if (!intent || !address) return;

    setPaymentState('awaiting_signature');
    setError(null);
    setVerifyRetries(0);
    setWasRejected(false);

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
            console.error('Transaction error:', err);
            
            if (isUserRejection(err)) {
              setWasRejected(true);
              if (address) {
                disableAutopay(address);
                setAutopayDisabledMessage(true);
              }
              setError('Payment canceled. Click the button when ready to pay.');
            } else {
              setError(err.message || 'Transaction failed');
            }
            
            setPaymentState('failed');
            setNeedsNewPayment(true);
          },
        }
      );
    } catch (err) {
      console.error('Payment error:', err);
      
      if (isUserRejection(err)) {
        setWasRejected(true);
        if (address) {
          disableAutopay(address);
          setAutopayDisabledMessage(true);
        }
        setError('Payment canceled. Click the button when ready to pay.');
      } else {
        setError(err instanceof Error ? err.message : 'Transaction failed');
      }
      
      setPaymentState('failed');
      setNeedsNewPayment(true);
    }
  }, [intent, address, sendTransaction]);

  // Verify payment with backend
  const verifyPayment = useCallback(async (isRetry = false) => {
    if (!txHash || !intent?.token || !address) {
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
        setPaymentState('confirmed');
        setIsAutoRetrying(false);
        onPaymentConfirmed();
        return;
      }

      const { code, retryable, error: errorMsg } = data;

      if (retryable && verifyRetries < MAX_VERIFY_RETRIES) {
        setVerifyRetries(prev => prev + 1);
        retryTimeoutRef.current = setTimeout(() => {
          verifyPayment(true);
        }, VERIFY_RETRY_DELAY_MS);
        return;
      }

      setIsAutoRetrying(false);
      
      if (code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED' || code === 'MISSING_TOKEN') {
        setError('Payment session expired. Please make a new payment.');
        setNeedsNewPayment(true);
      } else if (code === 'TX_ALREADY_USED' || code === 'ALREADY_VERIFIED') {
        setPaymentState('confirmed');
        onPaymentConfirmed();
        return;
      } else if (verifyRetries >= MAX_VERIFY_RETRIES) {
        setError('Verification timed out. Please try again.');
        setNeedsNewPayment(false);
      } else {
        setError(errorMsg || 'Payment verification failed');
        setNeedsNewPayment(!retryable);
      }
      
      setPaymentState('failed');
    } catch (err) {
      console.error('Verify error:', err);
      setIsAutoRetrying(false);
      
      if (verifyRetries < MAX_VERIFY_RETRIES) {
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

  // Start verification when tx confirmed
  useEffect(() => {
    if (isConfirmed && txHash && intent && paymentState === 'tx_pending') {
      verifyPayment(false);
    }
  }, [isConfirmed, txHash, intent, paymentState, verifyPayment]);

  // Network switch
  const handleSwitchNetwork = () => {
    switchChain?.({ chainId: BASE_CHAIN_ID });
  };

  // Retry handler
  const handleRetry = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    setError(null);
    setVerifyRetries(0);
    setIsAutoRetrying(false);
    setAutopayDisabledMessage(false);
    
    if (needsNewPayment) {
      setTxHash(undefined);
      setIntent(null);
      setPaymentState('idle');
      setNeedsNewPayment(false);
    } else if (txHash && intent) {
      verifyPayment(false);
    } else {
      setPaymentState('idle');
    }
  };

  // Decline handler (for "No thanks" / "Later" button)
  const handleDecline = () => {
    onDecline?.();
  };

  const isQuoteExpired = intent && Date.now() > intent.expiresAt;

  const getCurrentStep = () => {
    if (!isConnected) return 1;
    if (!isOnBase) return 2;
    return 3;
  };

  const currentStep = getCurrentStep();

  return (
    <div className="payment-gate">
      <div className="payment-modal">
        <h2>🐍 {isReplay ? 'GAME OVER' : 'PIXEL SNAKE'}</h2>
        <p className="subtitle">
          {isReplay ? 'Play Again?' : 'Pay-to-Play'}
        </p>
        
        {isReplay && (
          <p className="replay-notice">
            {autopayDisabledMessage 
              ? "We won't auto-prompt again. Click when ready."
              : 'Each run requires a new payment'
            }
          </p>
        )}

        {/* Progress Steps */}
        <div className="steps">
          <div className={`step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Connect</span>
          </div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Base</span>
          </div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''} ${paymentState === 'confirmed' ? 'completed' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Pay</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="step-content">
          {/* Step 1: Connect */}
          {!isConnected && (
            <div className="connect-section">
              <p>Connect your wallet to play</p>
              <ConnectButton />
            </div>
          )}

          {/* Step 2: Switch Network */}
          {isConnected && !isOnBase && (
            <div className="network-section">
              <p>Switch to Base network</p>
              <button onClick={handleSwitchNetwork} disabled={isSwitching} className="action-btn">
                {isSwitching ? 'Switching...' : 'Switch to Base'}
              </button>
            </div>
          )}

          {/* Step 3: Payment */}
          {isConnected && isOnBase && (
            <div className="payment-section">
              {paymentState === 'loading_quote' && (
                <div className="loading">
                  <div className="spinner"></div>
                  <p>Fetching price...</p>
                </div>
              )}

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
                    {paymentState === 'awaiting_signature' ? 'Confirm in Wallet...' : isReplay ? '💰 Pay & Play Again' : '💰 Pay to Play'}
                  </button>
                  
                  {isReplay && onDecline && (
                    <button onClick={handleDecline} className="decline-btn">
                      Maybe Later
                    </button>
                  )}
                </div>
              )}

              {isQuoteExpired && paymentState === 'quote_ready' && (
                <div className="expired">
                  <p>Quote expired</p>
                  <button onClick={handleRetry} className="action-btn">Get New Quote</button>
                </div>
              )}

              {paymentState === 'tx_pending' && (
                <div className="pending">
                  <div className="spinner"></div>
                  <p>Transaction confirming...</p>
                  {txHash && (
                    <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="tx-link">
                      View on BaseScan ↗
                    </a>
                  )}
                </div>
              )}

              {paymentState === 'verifying' && (
                <div className="verifying">
                  <div className="spinner"></div>
                  <p>{isAutoRetrying ? `Confirming... (${verifyRetries}/${MAX_VERIFY_RETRIES})` : 'Verifying...'}</p>
                </div>
              )}

              {paymentState === 'confirmed' && (
                <div className="confirmed">
                  <span className="check">✓</span>
                  <p>Payment confirmed!</p>
                  <p className="starting">Starting game...</p>
                </div>
              )}

              {paymentState === 'failed' && (
                <div className="failed">
                  <p className="error-msg">{error || 'Payment failed'}</p>
                  <button onClick={handleRetry} className="action-btn">
                    {needsNewPayment ? 'Try Again' : 'Retry'}
                  </button>
                  {isReplay && onDecline && (
                    <button onClick={handleDecline} className="decline-btn">
                      Maybe Later
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wallet Info */}
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
          background: rgba(10, 10, 18, 0.97);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .payment-modal {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 3px solid #00ff88;
          border-radius: 16px;
          padding: 35px 40px;
          max-width: 400px;
          width: 90%;
          text-align: center;
          box-shadow: 0 0 50px rgba(0, 255, 136, 0.25);
        }

        h2 {
          font-size: 1.8rem;
          color: #00ff88;
          margin: 0 0 6px 0;
          text-shadow: 0 0 20px #00ff88;
        }

        .subtitle {
          color: #aaa;
          margin: 0 0 8px 0;
          font-size: 1rem;
        }

        .replay-notice {
          color: #ff6b6b;
          font-size: 0.85rem;
          margin: 0 0 20px 0;
          padding: 8px 14px;
          background: rgba(255, 107, 107, 0.1);
          border-radius: 6px;
        }

        .steps {
          display: flex;
          justify-content: center;
          gap: 30px;
          margin-bottom: 25px;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0.4;
          transition: opacity 0.3s;
        }

        .step.active { opacity: 1; }

        .step.completed .step-number {
          background: #00ff88;
          color: #0a0a12;
        }

        .step-number {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 2px solid #00ff88;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          margin-bottom: 6px;
          font-size: 0.85rem;
        }

        .step-label {
          font-size: 0.7rem;
          color: #888;
        }

        .step.active .step-label { color: #00ff88; }

        .step-content {
          min-height: 160px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .connect-section, .network-section, .payment-section { width: 100%; }

        .connect-section p, .network-section p {
          margin-bottom: 18px;
          color: #ccc;
        }

        .action-btn {
          padding: 12px 28px;
          font-size: 1rem;
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
          padding: 14px 28px;
          font-size: 1.1rem;
        }

        .pay-btn:hover:not(:disabled) {
          background: #ff6b6b;
          color: #0a0a12;
        }

        .decline-btn {
          margin-top: 12px;
          padding: 8px 20px;
          background: transparent;
          border: 1px solid #555;
          color: #888;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .decline-btn:hover {
          border-color: #888;
          color: #aaa;
        }

        .amount-display { margin-bottom: 18px; }

        .eth-amount {
          display: block;
          font-size: 1.6rem;
          color: #00ff88;
          font-weight: bold;
        }

        .fiat-amount {
          color: #888;
          font-size: 0.95rem;
        }

        .warning {
          color: #ffaa00;
          font-size: 0.8rem;
          margin-bottom: 12px;
        }

        .loading, .pending, .verifying {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(0, 255, 136, 0.2);
          border-top-color: #00ff88;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .tx-link {
          color: #00ff88;
          text-decoration: none;
          font-size: 0.85rem;
        }

        .tx-link:hover { text-decoration: underline; }

        .confirmed { color: #00ff88; }

        .check {
          font-size: 2.5rem;
          display: block;
          margin-bottom: 8px;
        }

        .starting {
          color: #888;
          font-size: 0.85rem;
        }

        .failed {
          color: #ff6b6b;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .error-msg {
          font-size: 0.9rem;
          max-width: 280px;
        }

        .wallet-info {
          margin-top: 25px;
          padding-top: 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .wallet-btn {
          background: transparent;
          border: 1px solid #444;
          color: #888;
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
        }

        .wallet-btn:hover {
          border-color: #888;
          color: #ccc;
        }

        @media (max-width: 500px) {
          .payment-modal {
            padding: 25px 20px;
          }
          h2 { font-size: 1.5rem; }
          .steps { gap: 20px; }
        }
      `}</style>
    </div>
  );
}
