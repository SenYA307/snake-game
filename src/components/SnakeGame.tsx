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
  SPEED_INCREASE_EVERY,
  INITIAL_SNAKE,
  FOOD_POINTS,
  BONUS_POINTS,
  BONUS_SPAWN_CHANCE,
  BONUS_DURATION,
  EXPLOSION_DURATION_MS,
  DEATH_PROMPT_DELAY_MS,
  type GameState
} from '@/lib/gameConstants';
import { setGameState as setAudioState, playEat, playBonus, playSparkle, stopAll } from '@/lib/audioManager';
import { AudioControls } from './AudioControls';

// ============ TYPES ============
interface Position {
  x: number;
  y: number;
}

interface Direction {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Sparkle {
  x: number;
  y: number;
  startTime: number;
}

interface SnakeGameProps {
  onRunEnded: (finalScore: number) => void;
  runNumber?: number;
}

// ============ SPRITE GENERATOR ============
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

    const colors: Record<number, string> = { 1: '#00ff88', 2: '#00cc6a', 3: '#ffffff', 4: '#000000', 5: '#ff6b6b' };
    const pixelMaps: Record<string, number[][]> = {
      right: [
        [0,0,1,1,1,1,0,0], [0,1,1,1,1,1,1,0], [1,1,3,3,1,3,3,1], [1,1,4,3,1,4,3,1],
        [1,1,1,1,1,1,1,5], [1,1,1,1,1,1,1,5], [0,1,1,1,1,1,1,0], [0,0,1,1,1,1,0,0]
      ],
      left: [
        [0,0,1,1,1,1,0,0], [0,1,1,1,1,1,1,0], [1,3,3,1,3,3,1,1], [1,3,4,1,3,4,1,1],
        [5,1,1,1,1,1,1,1], [5,1,1,1,1,1,1,1], [0,1,1,1,1,1,1,0], [0,0,1,1,1,1,0,0]
      ],
      up: [
        [0,0,1,1,1,1,0,0], [0,1,3,1,1,3,1,0], [1,1,4,1,1,4,1,1], [1,1,3,1,1,3,1,1],
        [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1], [0,1,1,1,1,1,1,0], [0,0,5,5,5,5,0,0]
      ],
      down: [
        [0,0,5,5,5,5,0,0], [0,1,1,1,1,1,1,0], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1],
        [1,1,3,1,1,3,1,1], [1,1,4,1,1,4,1,1], [0,1,3,1,1,3,1,0], [0,0,1,1,1,1,0,0]
      ],
    };
    const sprite = this.createSprite(pixelMaps[direction] || pixelMaps.down, colors);
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  getSnakeBody(isEven: boolean): HTMLCanvasElement {
    const key = 'body_' + isEven;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key)!;
    const colors: Record<number, string> = { 1: isEven ? '#00dd77' : '#00cc6a', 2: isEven ? '#00cc6a' : '#00bb5a' };
    const pixels = [
      [0,0,1,1,1,1,0,0], [0,1,2,1,1,2,1,0], [1,2,1,1,1,1,2,1], [1,1,1,2,2,1,1,1],
      [1,1,2,1,1,2,1,1], [1,2,1,1,1,1,2,1], [0,1,1,2,2,1,1,0], [0,0,1,1,1,1,0,0]
    ];
    const sprite = this.createSprite(pixels, colors);
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  getSnakeTail(direction: string): HTMLCanvasElement {
    const key = 'tail_' + direction;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key)!;
    const colors: Record<number, string> = { 1: '#00bb5a', 2: '#00aa4a' };
    const pixelMaps: Record<string, number[][]> = {
      right: [[0,0,0,0,1,1,0,0],[0,0,0,1,1,1,1,0],[0,0,1,1,1,1,1,1],[0,1,1,1,1,2,1,1],[0,1,1,1,1,2,1,1],[0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,0],[0,0,0,0,1,1,0,0]],
      left: [[0,0,1,1,0,0,0,0],[0,1,1,1,1,0,0,0],[1,1,1,1,1,1,0,0],[1,1,2,1,1,1,1,0],[1,1,2,1,1,1,1,0],[1,1,1,1,1,1,0,0],[0,1,1,1,1,0,0,0],[0,0,1,1,0,0,0,0]],
      up: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,1,1,0,0,0],[0,0,1,1,1,1,0,0],[0,1,1,2,2,1,1,0],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,0],[0,0,1,1,1,1,0,0]],
      down: [[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[0,1,1,2,2,1,1,0],[0,0,1,1,1,1,0,0],[0,0,0,1,1,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
    };
    const sprite = this.createSprite(pixelMaps[direction] || pixelMaps.down, colors);
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  getFood(): HTMLCanvasElement {
    if (this.spriteCache.has('food')) return this.spriteCache.get('food')!;
    const colors: Record<number, string> = { 1: '#ff4444', 2: '#cc2222', 3: '#44aa22', 4: '#ffffff', 5: '#ffaa00' };
    const pixels = [
      [0,0,0,0,3,3,0,0], [0,0,0,3,3,5,5,0], [0,1,1,1,1,1,1,0], [1,1,4,1,1,1,1,1],
      [1,4,1,1,1,1,2,1], [1,1,1,1,1,2,2,1], [0,1,1,1,1,1,1,0], [0,0,1,1,1,1,0,0]
    ];
    const sprite = this.createSprite(pixels, colors);
    this.spriteCache.set('food', sprite);
    return sprite;
  }

  getBonusFood(): HTMLCanvasElement {
    if (this.spriteCache.has('bonus')) return this.spriteCache.get('bonus')!;
    const colors: Record<number, string> = { 1: '#ffdd00', 2: '#ffaa00', 3: '#ffffff' };
    const pixels = [
      [0,0,0,3,1,0,0,0], [0,0,0,1,1,0,0,0], [0,0,1,1,1,1,0,0], [1,1,1,2,2,1,1,1],
      [0,1,1,2,2,1,1,0], [0,0,1,1,1,1,0,0], [0,1,1,0,0,1,1,0], [0,1,0,0,0,0,1,0]
    ];
    const sprite = this.createSprite(pixels, colors);
    this.spriteCache.set('bonus', sprite);
    return sprite;
  }
}

// ============ MAIN COMPONENT ============
export function SnakeGame({ onRunEnded }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<SpriteGenerator | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const renderLoopRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [applesEaten, setApplesEaten] = useState(0);

  // Game state refs
  const snakeRef = useRef<Position[]>(INITIAL_SNAKE.map(p => ({ ...p })));
  const prevSnakeRef = useRef<Position[]>(INITIAL_SNAKE.map(p => ({ ...p })));
  const directionRef = useRef<Direction>({ x: 1, y: 0 });
  const nextDirectionRef = useRef<Direction>({ x: 1, y: 0 });
  const directionQueueRef = useRef<Direction[]>([]);
  const foodRef = useRef<Position>({ x: 7, y: 5 });
  const bonusFoodRef = useRef<Position | null>(null);
  const bonusTimerRef = useRef(0);
  const scoreRef = useRef(0);
  const gameSpeedRef = useRef(INITIAL_GAME_SPEED);
  const applesRef = useRef(0);
  
  // Animation refs
  const particlesRef = useRef<Particle[]>([]);
  const sparklesRef = useRef<Sparkle[]>([]);
  const explosionStartRef = useRef<number>(0);
  const interpolationRef = useRef(0);

  // Initialize
  useEffect(() => {
    spritesRef.current = new SpriteGenerator();
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) setHighScore(parseInt(saved, 10));
    return () => { stopAll(); };
  }, []);

  // Safe food spawn
  const randomPosition = useCallback((): Position => {
    const occupied = new Set<string>();
    snakeRef.current.forEach(s => occupied.add(`${s.x},${s.y}`));
    if (foodRef.current) occupied.add(`${foodRef.current.x},${foodRef.current.y}`);
    if (bonusFoodRef.current) occupied.add(`${bonusFoodRef.current.x},${bonusFoodRef.current.y}`);
    
    const available: Position[] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      for (let y = 0; y < GRID_ROWS; y++) {
        if (!occupied.has(`${x},${y}`)) {
          // Avoid spawning too close to snake head
          const head = snakeRef.current[0];
          const dist = Math.abs(x - head.x) + Math.abs(y - head.y);
          if (dist >= 2) available.push({ x, y });
        }
      }
    }
    
    if (available.length === 0) {
      return { x: Math.floor(Math.random() * GRID_COLS), y: Math.floor(Math.random() * GRID_ROWS) };
    }
    return available[Math.floor(Math.random() * available.length)];
  }, []);

  const getDirectionFromTo = (from: Position, to: Position): string => {
    if (to.x > from.x) return 'right';
    if (to.x < from.x) return 'left';
    if (to.y > from.y) return 'down';
    return 'up';
  };

  // Spawn particles for explosion
  const spawnExplosionParticles = useCallback((x: number, y: number) => {
    const colors = ['#ff4444', '#ff8844', '#ffcc44', '#ffff44', '#ffffff', '#00ff88'];
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < 40; i++) {
      const angle = (Math.PI * 2 * i) / 40 + Math.random() * 0.3;
      const speed = 2 + Math.random() * 4;
      newParticles.push({
        x: x * CELL_SIZE + CELL_SIZE / 2,
        y: y * CELL_SIZE + CELL_SIZE / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.8 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 5,
      });
    }
    particlesRef.current = newParticles;
  }, []);

  // Spawn sparkles for food pickup
  const spawnSparkles = useCallback((x: number, y: number) => {
    sparklesRef.current.push({
      x: x * CELL_SIZE + CELL_SIZE / 2,
      y: y * CELL_SIZE + CELL_SIZE / 2,
      startTime: performance.now(),
    });
  }, []);

  // ============ RENDER ============
  const render = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const sprites = spritesRef.current;
    if (!canvas || !ctx || !sprites) return;

    // Calculate interpolation
    const tickProgress = gameSpeedRef.current > 0 
      ? Math.min(1, (timestamp - lastTickTimeRef.current) / gameSpeedRef.current)
      : 0;
    interpolationRef.current = gameState === 'PLAYING' ? tickProgress : 0;

    // Clear
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.06)';
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
      const pulse = Math.sin(timestamp / 80) * 0.15 + 0.85;
      ctx.globalAlpha = pulse;
      ctx.drawImage(sprites.getBonusFood(), bonus.x * CELL_SIZE, bonus.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.globalAlpha = 1;
    }

    // Sparkles
    sparklesRef.current = sparklesRef.current.filter(sparkle => {
      const age = timestamp - sparkle.startTime;
      if (age > 400) return false;
      
      const progress = age / 400;
      ctx.globalAlpha = 1 - progress;
      
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + progress * Math.PI;
        const dist = progress * CELL_SIZE * 0.8;
        const x = sparkle.x + Math.cos(angle) * dist;
        const y = sparkle.y + Math.sin(angle) * dist;
        
        ctx.fillStyle = i % 2 === 0 ? '#ffff00' : '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 3 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return true;
    });

    // Snake with interpolation
    const snake = snakeRef.current;
    const prevSnake = prevSnakeRef.current;
    const direction = directionRef.current;
    const alpha = interpolationRef.current;

    if (gameState !== 'DYING_ANIMATION' && gameState !== 'DEAD_PROMPT') {
      for (let i = snake.length - 1; i >= 0; i--) {
        const curr = snake[i];
        const prev = prevSnake[i] || curr;
        
        // Interpolate position
        let drawX = prev.x + (curr.x - prev.x) * alpha;
        let drawY = prev.y + (curr.y - prev.y) * alpha;
        
        // Handle wrap-around interpolation
        if (Math.abs(curr.x - prev.x) > GRID_COLS / 2) {
          drawX = curr.x;
        }
        if (Math.abs(curr.y - prev.y) > GRID_ROWS / 2) {
          drawY = curr.y;
        }

        let sprite: HTMLCanvasElement;
        if (i === 0) {
          let dir = 'right';
          if (direction.x === 1) dir = 'right';
          else if (direction.x === -1) dir = 'left';
          else if (direction.y === -1) dir = 'up';
          else if (direction.y === 1) dir = 'down';
          sprite = sprites.getSnakeHead(dir);
        } else if (i === snake.length - 1) {
          const prevSeg = snake[i - 1];
          sprite = sprites.getSnakeTail(getDirectionFromTo(curr, prevSeg));
        } else {
          sprite = sprites.getSnakeBody(i % 2 === 0);
        }

        ctx.drawImage(sprite, drawX * CELL_SIZE, drawY * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // Explosion particles
    if (gameState === 'DYING_ANIMATION' || particlesRef.current.length > 0) {
      const dt = 1 / 60;
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.vx *= 0.98;
        p.life -= dt / p.maxLife;
        
        if (p.life <= 0) return false;
        
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        return true;
      });
    }

    // Dim overlay during animation/pause
    if (gameState === 'DYING_ANIMATION' || gameState === 'PAUSED') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Continue render loop
    if (gameState === 'PLAYING' || gameState === 'DYING_ANIMATION' || gameState === 'PAUSED' || particlesRef.current.length > 0) {
      renderLoopRef.current = requestAnimationFrame(render);
    }
  }, [gameState]);

  // Start render loop
  useEffect(() => {
    if (gameState === 'PLAYING' || gameState === 'DYING_ANIMATION' || gameState === 'PAUSED') {
      renderLoopRef.current = requestAnimationFrame(render);
    }
    return () => {
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
    };
  }, [gameState, render]);

  // ============ GAME LOGIC ============
  const update = useCallback(() => {
    // Process direction queue
    if (directionQueueRef.current.length > 0) {
      const nextDir = directionQueueRef.current.shift()!;
      const current = directionRef.current;
      if (current.x + nextDir.x !== 0 || current.y + nextDir.y !== 0) {
        nextDirectionRef.current = nextDir;
      }
    }
    
    directionRef.current = nextDirectionRef.current;
    
    // Store previous positions for interpolation
    prevSnakeRef.current = snakeRef.current.map(p => ({ ...p }));

    let head: Position = {
      x: snakeRef.current[0].x + directionRef.current.x,
      y: snakeRef.current[0].y + directionRef.current.y,
    };

    // Wrap
    if (head.x < 0) head.x = GRID_COLS - 1;
    if (head.x >= GRID_COLS) head.x = 0;
    if (head.y < 0) head.y = GRID_ROWS - 1;
    if (head.y >= GRID_ROWS) head.y = 0;

    // Self collision
    if (snakeRef.current.some((s) => s.x === head.x && s.y === head.y)) {
      handleDeath();
      return;
    }

    snakeRef.current.unshift(head);

    let ate = false;
    const food = foodRef.current;
    
    if (head.x === food.x && head.y === food.y) {
      scoreRef.current += FOOD_POINTS;
      setScore(scoreRef.current);
      applesRef.current += 1;
      setApplesEaten(applesRef.current);
      
      spawnSparkles(food.x, food.y);
      foodRef.current = randomPosition();
      ate = true;
      playEat();
      playSparkle();

      // Progressive difficulty
      if (applesRef.current % SPEED_INCREASE_EVERY === 0 && gameSpeedRef.current > MIN_GAME_SPEED) {
        gameSpeedRef.current -= SPEED_INCREMENT;
      }

      // Spawn bonus
      if (Math.random() < BONUS_SPAWN_CHANCE && !bonusFoodRef.current) {
        bonusFoodRef.current = randomPosition();
        bonusTimerRef.current = BONUS_DURATION;
      }
    }

    const bonus = bonusFoodRef.current;
    if (bonus && head.x === bonus.x && head.y === bonus.y) {
      scoreRef.current += BONUS_POINTS;
      setScore(scoreRef.current);
      spawnSparkles(bonus.x, bonus.y);
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

    lastTickTimeRef.current = performance.now();
  }, [randomPosition, spawnSparkles]);

  const handleDeath = useCallback(() => {
    setGameState('DYING_ANIMATION');
    setAudioState('DYING_ANIMATION');
    
    if (gameLoopRef.current) {
      clearTimeout(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    
    const head = snakeRef.current[0];
    spawnExplosionParticles(head.x, head.y);
    explosionStartRef.current = performance.now();
    
    const finalScore = scoreRef.current;
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('snakeHighScore', finalScore.toString());
    }
    
    // After explosion, show prompt
    setTimeout(() => {
      setGameState('DEAD_PROMPT');
      setAudioState('DEAD_PROMPT');
    }, EXPLOSION_DURATION_MS + DEATH_PROMPT_DELAY_MS);
    
    // Notify parent
    setTimeout(() => {
      onRunEnded(finalScore);
    }, EXPLOSION_DURATION_MS + DEATH_PROMPT_DELAY_MS + 100);
  }, [highScore, onRunEnded, spawnExplosionParticles]);

  const gameLoop = useCallback(() => {
    update();
    gameLoopRef.current = window.setTimeout(gameLoop, gameSpeedRef.current);
  }, [update]);

  const startGame = useCallback(() => {
    snakeRef.current = INITIAL_SNAKE.map(p => ({ ...p }));
    prevSnakeRef.current = INITIAL_SNAKE.map(p => ({ ...p }));
    directionRef.current = { x: 1, y: 0 };
    nextDirectionRef.current = { x: 1, y: 0 };
    directionQueueRef.current = [];
    foodRef.current = randomPosition();
    bonusFoodRef.current = null;
    bonusTimerRef.current = 0;
    scoreRef.current = 0;
    gameSpeedRef.current = INITIAL_GAME_SPEED;
    applesRef.current = 0;
    particlesRef.current = [];
    sparklesRef.current = [];
    
    setScore(0);
    setApplesEaten(0);
    setGameState('PLAYING');
    setAudioState('PLAYING');
    
    lastTickTimeRef.current = performance.now();
    gameLoopRef.current = window.setTimeout(gameLoop, gameSpeedRef.current);
  }, [gameLoop, randomPosition]);

  const togglePause = useCallback(() => {
    if (gameState === 'PLAYING') {
      setGameState('PAUSED');
      setAudioState('PAUSED');
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    } else if (gameState === 'PAUSED') {
      setGameState('PLAYING');
      setAudioState('PLAYING');
      lastTickTimeRef.current = performance.now();
      gameLoopRef.current = window.setTimeout(gameLoop, gameSpeedRef.current);
    }
  }, [gameState, gameLoop]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Pause
      if (key === ' ' || key === 'escape' || key === 'p') {
        e.preventDefault();
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          togglePause();
        }
        return;
      }
      
      if (gameState !== 'PLAYING') return;
      
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
      }

      const directions: Record<string, Direction> = {
        arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
      };

      const newDir = directions[key];
      if (newDir) {
        // Direction buffering - queue up to 2 moves
        if (directionQueueRef.current.length < 2) {
          const lastDir = directionQueueRef.current.length > 0 
            ? directionQueueRef.current[directionQueueRef.current.length - 1]
            : directionRef.current;
          if (lastDir.x + newDir.x !== 0 || lastDir.y + newDir.y !== 0) {
            directionQueueRef.current.push(newDir);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, togglePause]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
      stopAll();
    };
  }, []);

  // Initial draw
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const sprites = spritesRef.current;
    if (!canvas || !ctx || !sprites) return;
    
    render(performance.now());
  }, [render]);

  const setDirection = (dir: string) => {
    if (gameState !== 'PLAYING') return;
    const directions: Record<string, Direction> = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
    };
    const newDir = directions[dir];
    if (newDir && directionQueueRef.current.length < 2) {
      const lastDir = directionQueueRef.current.length > 0 
        ? directionQueueRef.current[directionQueueRef.current.length - 1]
        : directionRef.current;
      if (lastDir.x + newDir.x !== 0 || lastDir.y + newDir.y !== 0) {
        directionQueueRef.current.push(newDir);
      }
    }
  };

  const isIdle = gameState === 'IDLE';
  const isPaused = gameState === 'PAUSED';

  return (
    <div className="game-wrapper">
      <div className="header-row">
        <h1>🐍 PIXEL SNAKE</h1>
        <AudioControls />
      </div>

      <div className="game-container">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
        
        {isPaused && (
          <div className="overlay pause-overlay">
            <h2>⏸ PAUSED</h2>
            <p>Press <span>SPACE</span> to resume</p>
          </div>
        )}
      </div>

      <div className="score-panel">
        <div className="score-box">SCORE: {score}</div>
        <div className="score-box">BEST: {highScore}</div>
        <div className="score-box small">🍎 {applesEaten}</div>
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
          <button className="control-btn pause-btn" onClick={togglePause}>
            {isPaused ? '▶' : '⏸'}
          </button>
          <button className="control-btn" onClick={() => setDirection('right')}>▶</button>
        </div>
        <div className="control-row">
          <button className="control-btn" onClick={() => setDirection('down')}>▼</button>
        </div>
      </div>

      <div className="instructions">
        <span>ARROWS</span> / <span>WASD</span> move · <span>SPACE</span> pause
      </div>

      <style jsx>{`
        .game-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px;
          min-height: 100vh;
        }

        .header-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        h1 {
          font-size: 2rem;
          color: #00ff88;
          text-shadow: 0 0 10px #00ff88, 0 0 20px #00ff88;
          margin: 0;
          letter-spacing: 3px;
        }

        .game-container {
          position: relative;
          padding: 10px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 4px solid #00ff88;
          border-radius: 8px;
          box-shadow: 0 0 30px rgba(0, 255, 136, 0.25), inset 0 0 30px rgba(0, 0, 0, 0.5);
        }

        canvas {
          display: block;
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          max-width: 90vw;
          max-height: 55vh;
          width: auto;
          height: auto;
        }

        .overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(10, 10, 20, 0.95);
          padding: 30px 50px;
          border-radius: 12px;
          text-align: center;
          z-index: 10;
        }

        .pause-overlay {
          border: 3px solid #00ff88;
          box-shadow: 0 0 30px rgba(0, 255, 136, 0.3);
        }

        .pause-overlay h2 {
          color: #00ff88;
          font-size: 1.8rem;
          margin-bottom: 10px;
        }

        .pause-overlay p {
          font-size: 1rem;
          color: #aaa;
        }

        .pause-overlay span {
          color: #00ff88;
          font-weight: bold;
        }

        .score-panel {
          display: flex;
          gap: 15px;
          margin-top: 16px;
          font-size: 1rem;
        }

        .score-box {
          background: rgba(0, 255, 136, 0.1);
          border: 2px solid #00ff88;
          padding: 8px 16px;
          border-radius: 4px;
        }

        .score-box.small {
          background: rgba(255, 100, 100, 0.1);
          border-color: #ff6b6b;
          color: #ff6b6b;
        }

        .start-btn {
          margin-top: 20px;
          padding: 14px 40px;
          font-size: 1.2rem;
          background: transparent;
          border: 3px solid #00ff88;
          color: #00ff88;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 2px;
          border-radius: 6px;
        }

        .start-btn:hover {
          background: #00ff88;
          color: #0a0a12;
          box-shadow: 0 0 25px rgba(0, 255, 136, 0.5);
        }

        .mobile-controls {
          display: none;
          margin-top: 20px;
          gap: 6px;
          flex-direction: column;
        }

        .control-row {
          display: flex;
          justify-content: center;
          gap: 6px;
        }

        .control-btn {
          width: 52px;
          height: 52px;
          font-size: 1.3rem;
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

        .pause-btn {
          background: rgba(255, 170, 0, 0.1);
          border-color: #ffaa00;
          color: #ffaa00;
        }

        .instructions {
          margin-top: 16px;
          font-size: 0.9rem;
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
            font-size: 1.3rem;
          }
          .header-row {
            flex-direction: column;
            gap: 10px;
          }
          .game-container {
            padding: 6px;
          }
          .score-panel {
            gap: 8px;
            font-size: 0.85rem;
          }
          .score-box {
            padding: 6px 10px;
          }
        }
      `}</style>
    </div>
  );
}
