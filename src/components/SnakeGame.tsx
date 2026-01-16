'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ===== PIXEL ART SPRITE GENERATOR =====
class SpriteGenerator {
  private spriteCache: Map<string, HTMLCanvasElement> = new Map();

  createSprite(pixelData: number[][], colors: Record<number, string>, size = 20): HTMLCanvasElement {
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
  const [isRunning, setIsRunning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  // Game state refs (to avoid stale closures in game loop)
  const snakeRef = useRef<Position[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const directionRef = useRef<Direction>({ x: 1, y: 0 });
  const nextDirectionRef = useRef<Direction>({ x: 1, y: 0 });
  const foodRef = useRef<Position>({ x: 15, y: 10 });
  const bonusFoodRef = useRef<Position | null>(null);
  const bonusTimerRef = useRef(0);
  const scoreRef = useRef(0);
  const gameSpeedRef = useRef(300);

  const gridSize = 20;
  const tileCount = 20;

  // Initialize sprites
  useEffect(() => {
    spritesRef.current = new SpriteGenerator();
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const randomPosition = useCallback((): Position => {
    let pos: Position;
    do {
      pos = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
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
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= tileCount; i++) {
      ctx.beginPath();
      ctx.moveTo(i * gridSize, 0);
      ctx.lineTo(i * gridSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * gridSize);
      ctx.lineTo(canvas.width, i * gridSize);
      ctx.stroke();
    }

    // Food
    const food = foodRef.current;
    ctx.drawImage(sprites.getFood(), food.x * gridSize, food.y * gridSize, gridSize, gridSize);

    // Bonus food
    const bonus = bonusFoodRef.current;
    if (bonus) {
      const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.8;
      ctx.globalAlpha = pulse;
      ctx.drawImage(sprites.getBonusFood(), bonus.x * gridSize, bonus.y * gridSize, gridSize, gridSize);
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

      ctx.drawImage(sprite, segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);
    }
  }, []);

  const update = useCallback(() => {
    directionRef.current = nextDirectionRef.current;

    let head: Position = {
      x: snakeRef.current[0].x + directionRef.current.x,
      y: snakeRef.current[0].y + directionRef.current.y,
    };

    // Wrap through walls
    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    // Self collision
    if (snakeRef.current.some((s) => s.x === head.x && s.y === head.y)) {
      handleGameOver();
      return;
    }

    snakeRef.current.unshift(head);

    let ate = false;
    const food = foodRef.current;
    
    if (head.x === food.x && head.y === food.y) {
      scoreRef.current += 10;
      setScore(scoreRef.current);
      foodRef.current = randomPosition();
      ate = true;

      if (Math.random() < 0.3 && !bonusFoodRef.current) {
        bonusFoodRef.current = randomPosition();
        bonusTimerRef.current = 50;
      }

      if (gameSpeedRef.current > 160) {
        gameSpeedRef.current -= 4;
      }
    }

    const bonus = bonusFoodRef.current;
    if (bonus && head.x === bonus.x && head.y === bonus.y) {
      scoreRef.current += 50;
      setScore(scoreRef.current);
      bonusFoodRef.current = null;
      bonusTimerRef.current = 0;
      ate = true;
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
    setIsGameOver(true);
    setIsRunning(false);
    
    const finalScore = scoreRef.current;
    
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('snakeHighScore', finalScore.toString());
    }
    
    // === PAY-PER-RUN: Notify parent that run ended ===
    // This will trigger the paywall to appear
    // Small delay to let the game over screen show briefly
    setTimeout(() => {
      onRunEnded(finalScore);
    }, 2000); // Show "Game Over" for 2 seconds, then paywall
  }, [highScore, onRunEnded]);

  const gameLoop = useCallback(() => {
    update();
    gameLoopRef.current = window.setTimeout(gameLoop, gameSpeedRef.current);
  }, [update]);

  const startGame = useCallback(() => {
    // Reset state
    snakeRef.current = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    directionRef.current = { x: 1, y: 0 };
    nextDirectionRef.current = { x: 1, y: 0 };
    foodRef.current = randomPosition();
    bonusFoodRef.current = null;
    bonusTimerRef.current = 0;
    scoreRef.current = 0;
    gameSpeedRef.current = 300;
    
    setScore(0);
    setIsGameOver(false);
    setIsRunning(true);

    draw();
    gameLoopRef.current = window.setTimeout(gameLoop, gameSpeedRef.current);
  }, [draw, gameLoop, randomPosition]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
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
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
      }
    };
  }, []);

  // Initial draw
  useEffect(() => {
    draw();
  }, [draw]);

  const setDirection = (dir: string) => {
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

  return (
    <div className="game-wrapper">
      <h1>🐍 PIXEL SNAKE</h1>

      <div className="game-container">
        <canvas ref={canvasRef} width={400} height={400} />
        
        {isGameOver && (
          <div className="game-over">
            <h2>GAME OVER</h2>
            <p>Score: {score}</p>
            <p className="pay-notice">Pay again to play another run...</p>
          </div>
        )}
      </div>

      <div className="score-panel">
        <div className="score-box">SCORE: {score}</div>
        <div className="score-box">BEST: {highScore}</div>
      </div>

      {!isRunning && !isGameOver && (
        <button className="start-btn" onClick={startGame}>
          START GAME
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
        }

        h1 {
          font-size: 2.5rem;
          color: #00ff88;
          text-shadow: 0 0 10px #00ff88, 0 0 20px #00ff88;
          margin-bottom: 20px;
          letter-spacing: 6px;
        }

        .game-container {
          position: relative;
          padding: 15px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 4px solid #00ff88;
          border-radius: 8px;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
        }

        canvas {
          display: block;
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }

        .game-over {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(10, 10, 18, 0.95);
          padding: 40px;
          border: 4px solid #ff6b6b;
          text-align: center;
          z-index: 10;
        }

        .game-over h2 {
          color: #ff6b6b;
          font-size: 2rem;
          margin-bottom: 15px;
          text-shadow: 0 0 20px #ff6b6b;
        }

        .game-over p {
          font-size: 1.3rem;
          margin-bottom: 20px;
        }

        .game-over .pay-notice {
          font-size: 0.9rem;
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
          font-size: 1.3rem;
        }

        .score-box {
          background: rgba(0, 255, 136, 0.1);
          border: 2px solid #00ff88;
          padding: 10px 20px;
          border-radius: 4px;
        }

        .start-btn {
          margin-top: 20px;
          padding: 15px 40px;
          font-size: 1.3rem;
          background: transparent;
          border: 3px solid #ff6b6b;
          color: #ff6b6b;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 2px;
        }

        .start-btn:hover {
          background: #ff6b6b;
          color: #0a0a12;
          box-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
        }

        .mobile-controls {
          display: none;
          margin-top: 20px;
          gap: 10px;
          flex-direction: column;
        }

        .control-row {
          display: flex;
          justify-content: center;
          gap: 10px;
        }

        .control-btn {
          width: 55px;
          height: 55px;
          font-size: 1.5rem;
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
          margin-top: 25px;
          font-size: 1.1rem;
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
            font-size: 1.8rem;
          }
        }
      `}</style>
    </div>
  );
}
