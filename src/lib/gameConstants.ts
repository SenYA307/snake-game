/**
 * Game Board Constants
 * 
 * Single source of truth for game dimensions.
 * 
 * GRID is 2x smaller than original (10x10 instead of 20x20)
 * but CELL_SIZE is larger for comfortable viewing.
 */

// ============ LOGICAL GRID SIZE (gameplay) ============
export const GRID_COLS = 10;         // Columns (was 20, now 10 = 2x smaller)
export const GRID_ROWS = 10;         // Rows (was 20, now 10 = 2x smaller)

// ============ VISUAL SIZE (rendering) ============
export const CELL_SIZE = 40;         // Pixels per cell (increased from 20 for visibility)
export const CANVAS_WIDTH = GRID_COLS * CELL_SIZE;   // 400px
export const CANVAS_HEIGHT = GRID_ROWS * CELL_SIZE;  // 400px

// ============ GAME SPEED ============
export const INITIAL_GAME_SPEED = 280;  // ms between updates (slightly faster for smaller board)
export const MIN_GAME_SPEED = 140;
export const SPEED_INCREMENT = 5;

// ============ SNAKE INITIAL POSITION ============
// Centered in the smaller grid
export const INITIAL_SNAKE = [
  { x: 5, y: 5 },
  { x: 4, y: 5 },
  { x: 3, y: 5 },
];

// ============ SCORING ============
export const FOOD_POINTS = 10;
export const BONUS_POINTS = 50;
export const BONUS_SPAWN_CHANCE = 0.3;
export const BONUS_DURATION = 40;  // Updates before bonus disappears (reduced for smaller board)

// ============ GAME STATES ============
export type GameState = 'IDLE' | 'PLAYING' | 'DEAD' | 'PAYWALL';
