'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  INITIAL_GAME_SPEED, 
  MIN_GAME_SPEED, 
  SPEED_INCREMENT,
  INITIAL_SNAKE,
  FOOD_POINTS,
  BONUS_POINTS,
  BONUS_SPAWN_CHANCE,
  BONUS_DURATION,
  type GameState
} from '@/lib/gameConstants';
import { setGameState, playEat, playBonus, stopAll } from '@/lib/audioManager';
import { AudioControls } from './AudioControls';

// ===== PIXEL ART SPRITE GENERATOR =====
class SpriteGenerator {
  private spriteCache: Map<string, HTMLCanvasElement> = new Map();

  createSprite(pixelData: number[][], colors: Record<number, string>, size = CELL_SIZE): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const pixelSize = size / pixelData.length;

    for (let y = 0; y < pixelData.length; y++) {
      for (let x = 0; x < pixelData[y].length; x++) {
        const colorIndex = pixelData[y][x];
        if (colorIndex > 0 && colors[colorIndex]) {
          ctx.fillStyle = colors[colorIndex];
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize + 0.5, pixelSize + 0.5);
        }
      }
    }

    return canvas;
  }

  getSnakeHead(direction: string): HTMLCanvasElement {
    const key = 'head_' + direction;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key)!;

    const colors: Record<number, string> = {
      1: '#00ff88',
      2: '#00cc6a',
      3: '#ffffff',
      4: '#000000',
      5: '#ff6b6b',
    };

    let pixels: number[][];
    switch (direction) {
      case 'right':
        pixels = [
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 3, 3, 1, 3, 3, 1],
          [1, 1, 4, 3, 1, 4, 3, 1],
          [1, 1, 1, 1, 1, 1, 1, 5],
          [1, 1, 1, 1, 1, 1, 1, 5],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [0, 0, 1, 1, 1, 1, 0, 0],
        ];
        break;
      case 'left':
        pixels = [
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 3, 3, 1, 3, 3, 1, 1],
          [1, 3, 4, 1, 3, 4, 1, 1],
          [5, 1, 1, 1, 1, 1, 1, 1],
          [5, 1, 1, 1, 1, 1, 1, 1],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [0, 0, 1, 1, 1, 1, 0, 0],
        ];
        break;
      case 'up':
        pixels = [
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 1, 3, 1, 1, 3, 1, 0],
          [1, 1, 4, 1, 1, 4, 1, 1],
          [1, 1, 3, 1, 1, 3, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [0, 0, 5, 5, 5, 5, 0, 0],
        ];
        break;
      case 'down':
      default:
        pixels = [
          [0, 0, 5, 5, 5, 5, 0, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 3, 1, 1, 3, 1, 1],
          [1, 1, 4, 1, 1, 4, 1, 1],
          [0, 1, 3, 1, 1, 3, 1, 0],
          [0, 0, 1, 1, 1, 1, 0, 0],
        ];
        break;
    }

    const sprite = this.createSprite(pixels, colors);
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  getSnakeBody(isEven: boolean): HTMLCanvasElement {
    const key = 'body_' + isEven;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key)!;

    const colors: Record<number, string> = {
      1: isEven ? '#00dd77' : '#00cc6a',
      2: isEven ? '#00cc6a' : '#00bb5a',
    };

    const pixels = [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 2, 1, 1, 2, 1, 0],
      [1, 2, 1, 1, 1, 1, 2, 1],
      [1, 1, 1, 2, 2, 1, 1, 1],
      [1, 1, 2, 1, 1, 2, 1, 1],
      [1, 2, 1, 1, 1, 1, 2, 1],
      [0, 1, 1, 2, 2, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
    ];

    const sprite = this.createSprite(pixels, colors);
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  getSnakeTail(direction: string): HTMLCanvasElement {
    const key = 'tail_' + direction;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key)!;

    const colors: Record<number, string> = {
      1: '#00bb5a',
      2: '#00aa4a',
    };

    let pixels: number[][];
    switch (direction) {
      case 'right':
        pixels = [
          [0, 0, 0, 0, 1, 1, 0, 0],
          [0, 0, 0, 1, 1, 1, 1, 0],
          [0, 0, 1, 1, 1, 1, 1, 1],
          [0, 1, 1, 1, 1, 2, 1, 1],
          [0, 1, 1, 1, 1, 2, 1, 1],
          [0, 0, 1, 1, 1, 1, 1, 1],
          [0, 0, 0, 1, 1, 1, 1, 0],
          [0, 0, 0, 0, 1, 1, 0, 0],
        ];
        break;
      case 'left':
        pixels = [
          [0, 0, 1, 1, 0, 0, 0, 0],
          [0, 1, 1, 1, 1, 0, 0, 0],
          [1, 1, 1, 1, 1, 1, 0, 0],
          [1, 1, 2, 1, 1, 1, 1, 0],
          [1, 1, 2, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 0, 0, 0],
          [0, 0, 1, 1, 0, 0, 0, 0],
        ];
        break;
      case 'up':
        pixels = [
          [0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 1, 1, 0, 0, 0],
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 1, 1, 2, 2, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [0, 0, 1, 1, 1, 1, 0, 0],
        ];
        break;
      case 'down':
      default:
        pixels = [
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [0, 1, 1, 2, 2, 1, 1, 0],
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 0, 0, 1, 1, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0],
        ];
        break;
    }

    const sprite = this.createSprite(pixels, colors);
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  getFood(): HTMLCanvasElement {
    if (this.spriteCache.has('food')) return this.spriteCache.get('food')!;

    const colors: Record<number, string> = {
      1: '#ff4444',
      2: '#cc2222',
      3: '#44aa22',
      4: '#ffffff',
      5: '#ffaa00',
    };

    const pixels = [
      [0, 0, 0, 0, 3, 3, 0, 0],
      [0, 0, 0, 3, 3, 5, 5, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 4, 1, 1, 1, 1, 1],
      [1, 4, 1, 1, 1, 1, 2, 1],
      [1, 1, 1, 1, 1, 2, 2, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
    ];

    const sprite = this.createSprite(pixels, colors);
    this.spriteCache.set('food', sprite);
    return sprite;
  }

  getBonusFood(): HTMLCanvasElement {
    if (this.spriteCache.has('bonus')) return this.spriteCache.get('bonus')!;

    const colors: Record<number, string> = {
      1: '#ffdd00',
      2: '#ffaa00',
      3: '#ffffff',
    };

    const pixels = [
      [0, 0, 0, 3, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [1, 1, 1, 2, 2, 1, 1, 1],
      [0, 1, 1, 2, 2, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 1, 0, 0, 0, 0, 1, 0],
    ];

    const sprite = this.createSprite(pixels, colors);
    this.spriteCache.set('bonus', sprite);
    return sprite;
  }
}

interface Position {
  x: number;
  y: number;
}

interface Direction {
  x: number;
  y: number;
}

interface SnakeGameProps {
  /** Called when the run ends (player dies). Required for pay-per-run. */
  onRunEnded: (finalScore: number) => void;
  /** Current run number (for display/tracking) */
  runNumber?: number;
}

/**
 * SnakeGame Component
 * 
 * PAY-PER-RUN: When the player dies, this component calls onRunEnded()
 * which triggers the parent to show the paywall again.
 * The game does NOT allow restart without a new payment.
 */
export function SnakeGame({ onRunEnded, runNumber = 1 }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<SpriteGenerator | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [currentState, setCurrentState] = useState<GameState>('IDLE');

  // Game state refs (to avoid stale closures in game loop)
  const snakeRef = useRef<Position[]>(INITIAL_SNAKE.map(p => ({ ...p })));
  const directionRef = useRef<Direction>({ x: 1, y: 0 });
  const nextDirectionRef = useRef<Direction>({ x: 1, y: 0 });
  const foodRef = useRef<Position>({ x: Math.floor(GRID_COLS * 0.75), y: Math.floor(GRID_ROWS / 2) });
  const bonusFoodRef = useRef<Position | null>(null);
  const bonusTimerRef = useRef(0);
  const scoreRef = useRef(0);
  const gameSpeedRef = useRef(INITIAL_GAME_SPEED);

  // Initialize sprites
  useEffect(() => {
    spritesRef.current = new SpriteGenerator();
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) setHighScore(parseInt(saved, 10));
    
    // Cleanup on unmount - stop all audio
    return () => {
      stopAll();
    };
  }, []);

  const randomPosition = useCallback((): Position => {
    let pos: Position;
    do {
      pos = {
        x: Math.floor(Math.random() * GRID_COLS),
        y: Math.floor(Math.random() * GRID_ROWS),
      };
    } while (snakeRef.current.some((s) => s.x === pos.x && s.y === pos.y));
    return pos;
  }, []);

  const getDirectionFromTo = (from: Position, to: Position): string => {
    if (to.x > from.x) return 'right';
    if (to.x < from.x) return 'left';
    if (to.y > from.y) return 'down';
    return 'up';
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const sprites = spritesRef.current;
    if (!canvas || !ctx || !sprites) return;

    // Clear
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= GRID_ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(canvas.width, i * CELL_SIZE);
      ctx.stroke();
    }

    // Food
    const food = foodRef.current;
    ctx.drawImage(sprites.getFood(), food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

    // Bonus food
    const bonus = bonusFoodRef.current;
    if (bonus) {
      const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.8;
      ctx.globalAlpha = pulse;
      ctx.drawImage(sprites.getBonusFood(), bonus.x * CELL_SIZE, bonus.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.globalAlpha = 1;
    }

    // Snake
    const snake = snakeRef.current;
    const direction = directionRef.current;
    
    for (let i = snake.length - 1; i >= 0; i--) {
      const segment = snake[i];
      let sprite: HTMLCanvasElement;

      if (i === 0) {
        let dir = 'right';
        if (direction.x === 1) dir = 'right';
        else if (direction.x === -1) dir = 'left';
        else if (direction.y === -1) dir = 'up';
        else if (direction.y === 1) dir = 'down';
        sprite = sprites.getSnakeHead(dir);
      } else if (i === snake.length - 1) {
        const prev = snake[i - 1];
        const dir = getDirectionFromTo(segment, prev);
        sprite = sprites.getSnakeTail(dir);
      } else {
        sprite = sprites.getSnakeBody(i % 2 === 0);
      }

      ctx.drawImage(sprite, segment.x * CELL_SIZE, segment.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }, []);

  const update = useCallback(() => {
    directionRef.current = nextDirectionRef.current;

    let head: Position = {
      x: snakeRef.current[0].x + directionRef.current.x,
      y: snakeRef.current[0].y + directionRef.current.y,
    };

    // Wrap through walls
    if (head.x < 0) head.x = GRID_COLS - 1;
    if (head.x >= GRID_COLS) head.x = 0;
    if (head.y < 0) head.y = GRID_ROWS - 1;
    if (head.y >= GRID_ROWS) head.y = 0;

    // Self collision
    if (snakeRef.current.some((s) => s.x === head.x && s.y === head.y)) {
      handleGameOver();
      return;
    }

    snakeRef.current.unshift(head);

    let ate = false;
    const food = foodRef.current;
    
    if (head.x === food.x && head.y === food.y) {
      scoreRef.current += FOOD_POINTS;
      setScore(scoreRef.current);
      foodRef.current = randomPosition();
      ate = true;
      playEat();

      if (Math.random() < BONUS_SPAWN_CHANCE && !bonusFoodRef.current) {
        bonusFoodRef.current = randomPosition();
        bonusTimerRef.current = BONUS_DURATION;
      }

      if (gameSpeedRef.current > MIN_GAME_SPEED) {
        gameSpeedRef.current -= SPEED_INCREMENT;
      }
    }

    const bonus = bonusFoodRef.current;
    if (bonus && head.x === bonus.x && head.y === bonus.y) {
      scoreRef.current += BONUS_POINTS;
      setScore(scoreRef.current);
      bonusFoodRef.current = null;
      bonusTimerRef.current = 0;
      ate = true;
      playBonus();
    }

    if (bonusFoodRef.current) {
      bonusTimerRef.current--;
      if (bonusTimerRef.current <= 0) {
        bonusFoodRef.current = null;
      }
    }

    if (!ate) {
      snakeRef.current.pop();
    }

    draw();
  }, [draw, randomPosition]);

  const handleGameOver = useCallback(() => {
    // === TRANSITION TO DEAD STATE ===
    // Audio manager will: fade BGM, play explosion, then silence
    setCurrentState('DEAD');
    setGameState('DEAD');
    
    if (gameLoopRef.current) {
      clearTimeout(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    
    const finalScore = scoreRef.current;
    
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('snakeHighScore', finalScore.toString());
    }
    
    // === PAY-PER-RUN: Notify parent that run ended ===
    // Delay to show "Game Over" and let explosion sound play
    setTimeout(() => {
      onRunEnded(finalScore);
    }, 2500);
  }, [highScore, onRunEnded]);

  const gameLoop = useCallback(() => {
    update();
    gameLoopRef.current = window.setTimeout(gameLoop, gameSpeedRef.current);
  }, [update]);

  const startGame = useCallback(() => {
    // Reset state
    snakeRef.current = INITIAL_SNAKE.map(p => ({ ...p }));
    directionRef.current = { x: 1, y: 0 };
    nextDirectionRef.current = { x: 1, y: 0 };
    foodRef.current = randomPosition();
    bonusFoodRef.current = null;
    bonusTimerRef.current = 0;
    scoreRef.current = 0;
    gameSpeedRef.current = INITIAL_GAME_SPEED;
    
    setScore(0);
    
    // === TRANSITION TO PLAYING STATE ===
    // Audio manager will start BGM
    setCurrentState('PLAYING');
    setGameState('PLAYING');

    draw();
    gameLoopRef.current = window.setTimeout(gameLoop, gameSpeedRef.current);
  }, [draw, gameLoop, randomPosition]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (currentState !== 'PLAYING') return;
      
      const key = e.key.toLowerCase();

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
      }

      const directions: Record<string, Direction> = {
        arrowup: { x: 0, y: -1 },
        w: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 },
        s: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 },
        a: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 },
        d: { x: 1, y: 0 },
      };

      const newDir = directions[key];
      if (newDir) {
        const current = directionRef.current;
        if (current.x + newDir.x !== 0 || current.y + newDir.y !== 0) {
          nextDirectionRef.current = newDir;
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
      }
      stopAll();
    };
  }, []);

  // Initial draw
  useEffect(() => {
    draw();
  }, [draw]);

  const setDirection = (dir: string) => {
    if (currentState !== 'PLAYING') return;
    
    const directions: Record<string, Direction> = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };

    const newDir = directions[dir];
    if (newDir) {
      const current = directionRef.current;
      if (current.x + newDir.x !== 0 || current.y + newDir.y !== 0) {
        nextDirectionRef.current = newDir;
      }
    }
  };

  const isGameOver = currentState === 'DEAD';
  const isIdle = currentState === 'IDLE';

  return (
    <div className="game-wrapper">
      <div className="header-row">
        <h1>🐍 PIXEL SNAKE</h1>
        <AudioControls />
      </div>

      <div className="game-container">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
        
        {isGameOver && (
          <div className="game-over">
            <h2>💀 GAME OVER</h2>
            <p>Score: {score}</p>
            <p className="pay-notice">Pay again to play another run...</p>
          </div>
        )}
      </div>

      <div className="score-panel">
        <div className="score-box">SCORE: {score}</div>
        <div className="score-box">BEST: {highScore}</div>
      </div>

      {isIdle && (
        <button className="start-btn" onClick={startGame}>
          ▶ START GAME
        </button>
      )}

      <div className="mobile-controls">
        <div className="control-row">
          <button className="control-btn" onClick={() => setDirection('up')}>▲</button>
        </div>
        <div className="control-row">
          <button className="control-btn" onClick={() => setDirection('left')}>◀</button>
          <button className="control-btn" onClick={() => setDirection('down')}>▼</button>
          <button className="control-btn" onClick={() => setDirection('right')}>▶</button>
        </div>
      </div>

      <div className="instructions">
        <span>ARROW KEYS</span> or <span>WASD</span> to move
      </div>

      <style jsx>{`
        .game-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          min-height: 100vh;
        }

        .header-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        h1 {
          font-size: 2.2rem;
          color: #00ff88;
          text-shadow: 0 0 10px #00ff88, 0 0 20px #00ff88;
          margin: 0;
          letter-spacing: 4px;
        }

        .game-container {
          position: relative;
          padding: 12px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 4px solid #00ff88;
          border-radius: 8px;
          box-shadow: 0 0 30px rgba(0, 255, 136, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.5);
        }

        canvas {
          display: block;
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          max-width: 90vw;
          max-height: 60vh;
          width: auto;
          height: auto;
        }

        .game-over {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(10, 10, 18, 0.95);
          padding: 30px 40px;
          border: 4px solid #ff6b6b;
          border-radius: 8px;
          text-align: center;
          z-index: 10;
          box-shadow: 0 0 40px rgba(255, 107, 107, 0.4);
        }

        .game-over h2 {
          color: #ff6b6b;
          font-size: 1.6rem;
          margin-bottom: 10px;
          text-shadow: 0 0 20px #ff6b6b;
        }

        .game-over p {
          font-size: 1.2rem;
          margin-bottom: 10px;
        }

        .game-over .pay-notice {
          font-size: 0.85rem;
          color: #888;
          margin-top: 15px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .score-panel {
          display: flex;
          gap: 20px;
          margin-top: 20px;
          font-size: 1.1rem;
        }

        .score-box {
          background: rgba(0, 255, 136, 0.1);
          border: 2px solid #00ff88;
          padding: 10px 20px;
          border-radius: 4px;
        }

        .start-btn {
          margin-top: 25px;
          padding: 14px 40px;
          font-size: 1.3rem;
          background: transparent;
          border: 3px solid #00ff88;
          color: #00ff88;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 3px;
          border-radius: 4px;
        }

        .start-btn:hover {
          background: #00ff88;
          color: #0a0a12;
          box-shadow: 0 0 25px rgba(0, 255, 136, 0.5);
        }

        .mobile-controls {
          display: none;
          margin-top: 25px;
          gap: 8px;
          flex-direction: column;
        }

        .control-row {
          display: flex;
          justify-content: center;
          gap: 8px;
        }

        .control-btn {
          width: 55px;
          height: 55px;
          font-size: 1.4rem;
          background: rgba(0, 255, 136, 0.1);
          border: 2px solid #00ff88;
          color: #00ff88;
          border-radius: 8px;
          cursor: pointer;
        }

        .control-btn:active {
          background: #00ff88;
          color: #0a0a12;
        }

        .instructions {
          margin-top: 20px;
          font-size: 0.95rem;
          color: #666;
        }

        .instructions span {
          color: #ff6b6b;
        }

        @media (max-width: 600px) {
          .mobile-controls {
            display: flex;
          }
          h1 {
            font-size: 1.4rem;
            letter-spacing: 2px;
          }
          .header-row {
            flex-direction: column;
            gap: 12px;
          }
          .game-container {
            padding: 8px;
          }
          .score-panel {
            gap: 10px;
          }
          .score-box {
            padding: 8px 14px;
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  );
}
