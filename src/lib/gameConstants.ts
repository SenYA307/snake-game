/**
 * Game Board Constants
 * 
 * Single source of truth for game dimensions and state.
 * 
 * GRID is 2x smaller than original (10x10 instead of 20x20)
 * but CELL_SIZE is larger for comfortable viewing.
 */

// ============ LOGICAL GRID SIZE (gameplay) ============
export const GRID_COLS = 10;         // Columns (2x smaller than original 20)
export const GRID_ROWS = 10;         // Rows (2x smaller than original 20)

// ============ VISUAL SIZE (rendering) ============
// Cell size determines visual board size
// Desktop: 50px cells = 500px board
// Mobile: scales down via CSS
export const CELL_SIZE = 50;         // Pixels per cell (larger for visibility)
export const CANVAS_WIDTH = GRID_COLS * CELL_SIZE;   // 500px
export const CANVAS_HEIGHT = GRID_ROWS * CELL_SIZE;  // 500px

// ============ GAME SPEED ============
export const INITIAL_GAME_SPEED = 220;  // ms between logic updates
export const MIN_GAME_SPEED = 100;      // Fastest speed
export const SPEED_INCREMENT = 8;       // Speed increase per apple
export const SPEED_INCREASE_EVERY = 3;  // Increase speed every N apples

// ============ SNAKE INITIAL POSITION ============
export const INITIAL_SNAKE = [
  { x: 5, y: 5 },
  { x: 4, y: 5 },
  { x: 3, y: 5 },
];

// ============ SCORING ============
export const FOOD_POINTS = 10;
export const BONUS_POINTS = 50;
export const BONUS_SPAWN_CHANCE = 0.25;
export const BONUS_DURATION = 35;

// ============ DEATH ANIMATION (Glitch + Fade) ============
export const DEATH_GLITCH_DURATION_MS = 150;    // Quick glitch burst
export const DEATH_FADE_DURATION_MS = 750;      // Slow, sad fade-out
export const DEATH_PROMPT_DELAY_MS = 200;       // Brief pause before prompt

// Glitch effect parameters
export const GLITCH_SHAKE_INTENSITY = 2;        // Max pixels of screen shake
export const GLITCH_JITTER_INTENSITY = 3;       // Max horizontal offset for segments
export const GLITCH_SCANLINE_OPACITY = 0.12;    // Scanline visibility

// ============ SPARKLE EFFECT ============
export const SPARKLE_DURATION_MS = 400;

// ============ GAME STATES ============
export type GameState = 
  | 'IDLE'              // Initial state, no run started
  | 'PAYWALL'           // Needs payment to play
  | 'PLAYING'           // Active gameplay
  | 'PAUSED'            // Game paused (Space key)
  | 'DYING_GLITCH'      // Glitch burst phase
  | 'DYING_FADE'        // Fade out phase
  | 'DEAD_PROMPT'       // "Play again?" overlay showing
  | 'PAYING'            // Creating intent / sending tx
  | 'VERIFYING';        // Waiting for verification

// ============ AUTOPAY STORAGE ============
export const AUTOPAY_DISABLED_KEY_PREFIX = 'snake_autopay_disabled_';

export function getAutopayKey(walletAddress: string): string {
  return `${AUTOPAY_DISABLED_KEY_PREFIX}${walletAddress.toLowerCase()}`;
}

export function isAutopayDisabled(walletAddress: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(getAutopayKey(walletAddress)) === '1';
}

export function disableAutopay(walletAddress: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getAutopayKey(walletAddress), '1');
  console.log(`🚫 Autopay disabled for wallet ${walletAddress.slice(0, 10)}...`);
}
