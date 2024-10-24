'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from "@/components/ui/button"

// Types
type PuyoColor = 'red' | 'green' | 'blue' | 'yellow' | 'purple' | null
type GameState = 'title' | 'active' | 'over' | 'pause'
type Grid = PuyoColor[][]

// Constants
const GRID_ROWS = 12
const GRID_COLS = 6
const COLORS: PuyoColor[] = ['red', 'green', 'blue', 'yellow', 'purple']

// Helper functions
const createEmptyGrid = (): Grid => Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null))

interface PuyoPair {
  color1: PuyoColor
  color2: PuyoColor
  x: number
  y: number
  rotation: number
}

// Custom CSS classes (in case Tailwind classes are not available)
const customStyles = `
  .puyo-red { background-color: #EF4444; }
  .puyo-green { background-color: #10B981; }
  .puyo-blue { background-color: #3B82F6; }
  .puyo-yellow { background-color: #F59E0B; }
  .puyo-cell {
    width: 2rem;
    height: 2rem;
    border: 1px solid #D1D5DB;
    transition: all 0.2s;
  }
`

const getSecondPuyoStyle = (rotation: number) => {
  switch (rotation) {
    case 0: // 上
      return { top: '-32px', left: '0px' }
    case 1: // 右
      return { top: '0px', left: '32px' }
    case 2: // 下
      return { top: '32px', left: '0px' }
    case 3: // 左
      return { top: '0px', left: '-32px' }
    default:
      return { top: '-32px', left: '0px' }
  }
}

const findMatches = (grid: Grid): [number, number][] => {
  const matches: [number, number][] = [];
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (grid[y][x]) {
        const color = grid[y][x];
        const group: [number, number][] = [[y, x]];
        const queue: [number, number][] = [[y, x]];
        const visited = new Set<string>();

        while (queue.length > 0) {
          const [cy, cx] = queue.shift()!;
          visited.add(`${cy},${cx}`);

          for (const [dy, dx] of directions) {
            const ny = cy + dy;
            const nx = cx + dx;
            if (
              ny >= 0 && ny < GRID_ROWS &&
              nx >= 0 && nx < GRID_COLS &&
              grid[ny][nx] === color &&
              !visited.has(`${ny},${nx}`)
            ) {
              group.push([ny, nx]);
              queue.push([ny, nx]);
            }
          }
        }

        if (group.length >= 4) {
          matches.push(...group);
        }
      }
    }
  }

  return matches;
};

const removeMatchedPuyos = (grid: Grid, matches: [number, number][]): Grid => {
  const newGrid = grid.map(row => [...row]);
  matches.forEach(([y, x]) => {
    newGrid[y][x] = null;
  });
  return newGrid;
};

export default function PuyoGame() {
  const [grid, setGrid] = useState<Grid>(createEmptyGrid())
  const [gameState, setGameState] = useState<GameState>('title')
  const [score, setScore] = useState(0)
  const [currentPuyo, setCurrentPuyo] = useState<PuyoPair | null>(null)
  const [nextPuyos, setNextPuyos] = useState<PuyoPair[]>([])
  const [chainCounter, setChainCounter] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [highScore, setHighScore] = useState(0)
  const audioContext = useRef<AudioContext | null>(null)
  const [fallSpeed, setFallSpeed] = useState(1000) // 初期落下速度（ミリ秒）
  const fallSpeedRef = useRef(1000) // useEffectで使用するためのref
  const [heldPuyo, setHeldPuyo] = useState<PuyoPair | null>(null)
  const [canHold, setCanHold] = useState(true)
  const [isChaining, setIsChaining] = useState(false)
  const [displayChainCounter, setDisplayChainCounter] = useState(0)
  const chainDisplayTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const generatePuyoPair = useCallback((): PuyoPair => {
    const colors: PuyoColor[] = ['red', 'green', 'blue', 'yellow', 'purple']
    const color1 = colors[Math.floor(Math.random() * colors.length)]
    const color2 = colors[Math.floor(Math.random() * colors.length)]
    return {
      color1,
      color2,
      x: 2,
      y: 0,
      rotation: 0,
    }
  }, [])

  const generateNextPuyos = useCallback(() => {
    return [generatePuyoPair(), generatePuyoPair(), generatePuyoPair(), generatePuyoPair()]
  }, [generatePuyoPair])

  useEffect(() => {
    const storedHighScore = localStorage.getItem('puyoPuyoHighScore')
    if (storedHighScore) {
      setHighScore(parseInt(storedHighScore, 10))
    }

    audioContext.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }, [])

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('puyoPuyoHighScore', score.toString())
    }
  }, [score, highScore])

  const playSound = (frequency: number, duration: number) => {
    if (audioContext.current) {
      const oscillator = audioContext.current.createOscillator()
      const gainNode = audioContext.current.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.current.destination)

      oscillator.frequency.setValueAtTime(frequency, audioContext.current.currentTime)
      gainNode.gain.setValueAtTime(0.1, audioContext.current.currentTime)

      oscillator.start()
      oscillator.stop(audioContext.current.currentTime + duration)
    }
  }

  const startGame = () => {
    setGrid(createEmptyGrid())
    setScore(0)
    setChainCounter(0)
    const initialNextPuyos = generateNextPuyos()
    setCurrentPuyo(initialNextPuyos[0])
    setNextPuyos(initialNextPuyos.slice(1))
    setGameState('active')
    setIsPaused(false)
    setFallSpeed(1000)
    fallSpeedRef.current = 1000
    setHeldPuyo(null)
    setCanHold(true)
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
  }

  const movePuyo = (direction: 'left' | 'right' | 'down') => {
    if (!currentPuyo || gameState !== 'active' || isPaused) return

    const newPuyo = { ...currentPuyo }
    if (direction === 'left') newPuyo.x -= 1
    if (direction === 'right') newPuyo.x += 1
    if (direction === 'down') newPuyo.y += 1

    if (isValidMove(newPuyo)) {
      setCurrentPuyo(newPuyo)
    } else if (direction === 'down') {
      placePuyo()
    }
  }

  const rotatePuyo = (direction: 'left' | 'right') => {
    if (!currentPuyo || gameState !== 'active' || isPaused) return

    const newPuyo = { ...currentPuyo }
    newPuyo.rotation = (newPuyo.rotation + (direction === 'left' ? -1 : 1) + 4) % 4

    if (isValidMove(newPuyo)) {
      setCurrentPuyo(newPuyo)
    }
  }

  const isValidMove = (puyo: PuyoPair): boolean => {
    const { x, y, rotation } = puyo
    const [x2, y2] = getSecondPuyoPosition(x, y, rotation)

    return (
      x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS &&
      x2 >= 0 && x2 < GRID_COLS && y2 >= 0 && y2 < GRID_ROWS &&
      !grid[y][x] && !grid[y2][x2]
    )
  }

  const getSecondPuyoPosition = (x: number, y: number, rotation: number): [number, number] => {
    switch (rotation) {
      case 0: return [x, y - 1]
      case 1: return [x + 1, y]
      case 2: return [x, y + 1]
      case 3: return [x - 1, y]
      default: return [x, y]
    }
  }

  const applyGravity = (grid: (PuyoColor | null)[][]): (PuyoColor | null)[][] => {
    const newGrid = grid.map(row => [...row]);
    const width = newGrid[0].length;
    const height = newGrid.length;

    for (let col = 0; col < width; col++) {
      let emptyRow = height - 1;
      for (let row = height - 1; row >= 0; row--) {
        if (newGrid[row][col] !== null) {
          if (row !== emptyRow) {
            newGrid[emptyRow][col] = newGrid[row][col];
            newGrid[row][col] = null;
          }
          emptyRow--;
        }
      }
    }

    return newGrid;
  };

  const animateChain = async (
    grid: (PuyoColor | null)[][],
    chainCount: number = 0  // chainCounterをchainCountに変更
  ) => {
    setIsChaining(true)
    const matchedPuyos = findMatches(grid);

    if (matchedPuyos.length > 0) {
      // マッチしたぷよを表示
      setGrid(grid);
      await new Promise(resolve => setTimeout(resolve, 250));

      // マッチしたぷよを消去
      const newGrid = removeMatchedPuyos(grid, matchedPuyos);
      setGrid(newGrid);
      setScore(prevScore => prevScore + matchedPuyos.length * 10 * (chainCount + 1));
      setChainCounter(chainCount + 1);
      setDisplayChainCounter(chainCount + 1);
      playSound(200, 0.1);
      await new Promise(resolve => setTimeout(resolve, 250));

      // 重力を適用
      const gridAfterGravity = applyGravity(newGrid);
      setGrid(gridAfterGravity);
      await new Promise(resolve => setTimeout(resolve, 250));

      // 次の連鎖をチェック
      await animateChain(gridAfterGravity, chainCount + 1);

      // チェーン表示のタイムアウトをクリア
      if (chainDisplayTimeoutRef.current) {
        clearTimeout(chainDisplayTimeoutRef.current);
      }
    } else {
      setChainCounter(0);
      setIsChaining(false)

      // チェーン表示を2秒間維持
      chainDisplayTimeoutRef.current = setTimeout(() => {
        setDisplayChainCounter(0);
      }, 2000);
    }
  };

  const placePuyo = () => {
    if (!currentPuyo) return;

    let newGrid = [...grid];
    const { x, y, color1, color2, rotation } = currentPuyo;
    const [x2, y2] = getSecondPuyoPosition(x, y, rotation);

    // 境界チェックを追加
    if (y < 0 || y >= GRID_ROWS || x < 0 || x >= GRID_COLS ||
        y2 < 0 || y2 >= GRID_ROWS || x2 < 0 || x2 >= GRID_COLS) {
      // ゲームオーバーの処理
      setGameState('over');
      return;
    }

    newGrid[y][x] = color1;
    newGrid[y2][x2] = color2;

    // 重力を適用
    newGrid = applyGravity(newGrid);

    setGrid(newGrid);
    setCurrentPuyo(null);
    setCanHold(true);

    // 連鎖アニメーションを開始
    animateChain(newGrid);

    // 次のぷよを設定
    const nextPuyo = nextPuyos[0];
    const newNextPuyos = [...nextPuyos.slice(1), generatePuyoPair()];
    setCurrentPuyo(nextPuyo);
    setNextPuyos(newNextPuyos);
  };

  const holdPuyo = () => {
    if (!currentPuyo || !canHold || gameState !== 'active' || isPaused) return

    if (heldPuyo) {
      const temp = currentPuyo
      setCurrentPuyo({ ...heldPuyo, x: 2, y: 0, rotation: 0 })
      setHeldPuyo(temp)
    } else {
      setHeldPuyo(currentPuyo)
      setCurrentPuyo(nextPuyos[0])
      setNextPuyos([...nextPuyos.slice(1), generatePuyoPair()])
    }

    setCanHold(false)
    playSound(600, 0.1)
  }

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'escape') {
        togglePause()
      }
      if (isPaused) return

      switch (e.key.toLowerCase()) {
        case 'a': movePuyo('left'); playSound(300, 0.1); break
        case 'd': movePuyo('right'); playSound(300, 0.1); break
        case 's': movePuyo('down'); playSound(200, 0.1); break
        case 'o': rotatePuyo('left'); playSound(400, 0.1); break
        case 'p': rotatePuyo('right'); playSound(400, 0.1); break
        case 'q': holdPuyo()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentPuyo, gameState, isPaused, movePuyo, rotatePuyo, togglePause, holdPuyo])

  useEffect(() => {
    if (gameState === 'active' && !isPaused && !isChaining) {
      const gameLoop = setInterval(() => {
        movePuyo('down')
      }, fallSpeed)

      return () => clearInterval(gameLoop)
    }
  }, [gameState, currentPuyo, isPaused, movePuyo, fallSpeed, isChaining])

  useEffect(() => {
    if (gameState === 'active' && !isPaused) {
      const speedIncreaseInterval = setInterval(() => {
        setFallSpeed(prevSpeed => {
          const newSpeed = prevSpeed / 1.1
          fallSpeedRef.current = newSpeed // refを更新
          return newSpeed
        })
      }, 10000) // 10秒ごとに速度を増加

      return () => clearInterval(speedIncreaseInterval)
    }
  }, [gameState, isPaused])

  const getPuyoColorClass = (color: PuyoColor): string => {
    switch (color) {
      case 'red':
        return 'bg-red-500'
      case 'green':
        return 'bg-green-500'
      case 'blue':
        return 'bg-blue-500'
      case 'yellow':
        return 'bg-yellow-500'
      case 'purple':
        return 'bg-purple-500'
      default:
        return 'bg-gray-200'
    }
  }

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (chainDisplayTimeoutRef.current) {
        clearTimeout(chainDisplayTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <style>{customStyles}</style>
      <h1 className="text-4xl font-bold mb-4">改造ぷよぷよ</h1>
      {gameState === 'title' && (
        <div className="text-center">
          <Button onClick={startGame} className="mb-4">ゲーム開始</Button>
          <p className="text-xl mb-4">ハイスコア: {highScore}</p>
          <div className="text-left mb-4">
            <h2 className="text-2xl font-semibold mb-2">操作方法:</h2>
            <ul>
              <li>A: 左に移動</li>
              <li>D: 右に移動</li>
              <li>S: 下に移動</li>
              <li>O: 左回転</li>
              <li>P: 右回転</li>
              <li>Q: ホールド</li>
              <li>ESC: ポーズ</li>
            </ul>
          </div>
        </div>
      )}
      {gameState === 'active' && (
        <div className="flex items-start gap-8">
          <div className="flex flex-col items-center">
            <h2 className="text-2xl font-semibold mb-2">HOLD</h2>
            {heldPuyo ? (
              <div className="flex flex-col">
                <div className={`puyo-cell ${getPuyoColorClass(heldPuyo.color2)}`} />
                <div className={`puyo-cell ${getPuyoColorClass(heldPuyo.color1)}`} />
              </div>
            ) : (
              <div className="w-8 h-16 border border-gray-300"></div>
            )}
          </div>
          
          <div className="flex flex-col items-center">
            <div className="flex justify-between w-full mb-4">
              <div className="text-xl font-semibold">スコア: {score}</div>
              <div className="text-xl font-semibold">
                 {displayChainCounter > 0 ? displayChainCounter : ''}連鎖
              </div>
            </div>
            
            <div className="border-4 border-gray-700 p-1 relative">
              {grid.map((row, rowIndex) => (
                <div key={rowIndex} className="flex">
                  {row.map((cell, cellIndex) => (
                    <div
                      key={cellIndex}
                      className={`puyo-cell ${getPuyoColorClass(cell)}`}
                    />
                  ))}
                </div>
              ))}
              
              {currentPuyo && (
                <div
                  className="absolute"
                  style={{
                    left: `calc(${currentPuyo.x * 32}px + 4px)`,
                    top: `calc(${currentPuyo.y * 32}px + 4px)`,
                  }}
                >
                  <div className={`puyo-cell ${getPuyoColorClass(currentPuyo.color1)}`} />
                  <div
                    className={`puyo-cell ${getPuyoColorClass(currentPuyo.color2)}`}
                    style={{
                      position: 'absolute',
                      ...getSecondPuyoStyle(currentPuyo.rotation),
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <h2 className="text-2xl font-semibold mb-2">Next</h2>
            <div className="flex flex-col space-y-2">
              {nextPuyos.map((puyo, index) => (
                <div key={index} className="flex flex-col">
                  <div className={`puyo-cell ${getPuyoColorClass(puyo.color2)}`} />
                  <div className={`puyo-cell ${getPuyoColorClass(puyo.color1)}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {gameState === 'over' && (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Game Over</h2>
          <p className="text-xl mb-2">Final Score: {score}</p>
          <p className="text-xl mb-4">High Score: {highScore}</p>
          <Button onClick={startGame}>Play Again</Button>
        </div>
      )}
      {isPaused && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg">
            <h2 className="text-3xl font-bold mb-4">Paused</h2>
            <Button onClick={togglePause}>Resume</Button>
          </div>
        </div>
      )}
    </div>
  )
}
