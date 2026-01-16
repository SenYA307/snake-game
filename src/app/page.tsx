'use client';

import { useState, useCallback } from 'react';
import { PaymentGate } from '@/components/PaymentGate';
import { SnakeGame } from '@/components/SnakeGame';

/**
 * Main Page Component
 * 
 * PAY-PER-RUN ENFORCEMENT:
 * 
 * Each game run (from start to death) requires a separate payment.
 * After death, the player must pay again to play another run.
 * 
 * Flow:
 * 1. User pays → hasRunTicket = true
 * 2. User starts game → run begins
 * 3. User dies → onRunEnded() → hasRunTicket = false → paywall shown
 * 4. User pays again → hasRunTicket = true → can start new run
 * 
 * Backend prevents txHash reuse, so each run genuinely requires a new tx.
 */
export default function Home() {
  // === PAY-PER-RUN STATE ===
  // This is reset to false after EVERY death, requiring new payment
  const [hasRunTicket, setHasRunTicket] = useState(false);
  
  // Track if this is the first run or a replay (for UI messaging)
  const [runCount, setRunCount] = useState(0);

  /**
   * Called when payment is verified by backend.
   * Grants a "ticket" for ONE run.
   */
  const handlePaymentConfirmed = useCallback(() => {
    console.log('Payment confirmed - granting run ticket');
    setHasRunTicket(true);
    setRunCount(prev => prev + 1);
  }, []);

  /**
   * Called when a game run ends (player dies).
   * Immediately invalidates the run ticket, requiring new payment.
   */
  const handleRunEnded = useCallback((finalScore: number) => {
    console.log(`Run ${runCount} ended with score: ${finalScore}`);
    
    // === CRITICAL: Invalidate the ticket ===
    // This forces the paywall to appear for the next run
    setHasRunTicket(false);
  }, [runCount]);

  return (
    <main>
      {/* === PAYMENT GATE === */}
      {/* Shows after EVERY death, not just the first time */}
      {!hasRunTicket && (
        <PaymentGate 
          onPaymentConfirmed={handlePaymentConfirmed}
          isReplay={runCount > 0}
        />
      )}

      {/* === GAME CONTENT === */}
      {/* Only rendered while player has a valid run ticket */}
      {hasRunTicket && (
        <SnakeGame 
          onRunEnded={handleRunEnded}
          runNumber={runCount}
        />
      )}
    </main>
  );
}
