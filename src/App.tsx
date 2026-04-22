/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  RotateCcw, 
  Settings, 
  Lightbulb, 
  Eraser, 
  Grid3X3,
  Play,
  X,
  Volume2,
  VolumeX,
  Smartphone,
  ChevronRight
} from 'lucide-react';
import { GameState, LineSegment, Point, Direction } from './types';
import { generateLevel } from './lib/levelGenerator';
import { isBlocked, getDirectionVector, getBlockingDistance } from './lib/utils';

const INITIAL_HEARTS = 3;

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    gridSize: 30,
    lines: [],
    hearts: INITIAL_HEARTS,
    level: 1,
    gameOver: false,
    victory: false,
    showVictorySummary: false,
    activeItems: {
      removeMode: false,
      guideLines: false,
    },
    clearedPoints: [],
    currentMask: []
  });

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ volume: true, vibration: true });
  const [failedLines, setFailedLines] = useState<Set<string>>(new Set());
  const [bouncingLine, setBouncingLine] = useState<{id: string, count: number, distance: number}>({id: '', count: 0, distance: 0});
  const [resetKey, setResetKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const totalDrag = useRef(0);
  const lastTouch = useRef<Point | null>(null);

  // Initialize level
  useEffect(() => {
    const levelData = generateLevel(gameState.level);
    setGameState(prev => ({ 
        ...prev, 
        lines: levelData.lines, 
        gridSize: levelData.gridSize,
        currentMask: levelData.mask 
    }));
  }, [gameState.level]);

  const handleLevelComplete = useCallback(() => {
    setGameState(prev => ({ 
      ...prev, 
      victory: true, 
      showVictorySummary: true,
    }));
  }, []);

  const restartLevel = useCallback(() => {
    const levelData = generateLevel(gameState.level);
    setGameState(prev => ({ 
      ...prev, 
      lines: levelData.lines, 
      hearts: INITIAL_HEARTS, 
      gameOver: false, 
      victory: false, 
      showVictorySummary: false,
      activeItems: { removeMode: false, guideLines: false },
      clearedPoints: [],
      currentMask: levelData.mask
    }));
    setFailedLines(new Set());
    setBouncingLine({id: '', count: 0, distance: 0});
    setResetKey(prev => prev + 1);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [gameState.level]);

  const nextLevel = useCallback(() => {
    const nextLvl = gameState.level + 1;
    const levelData = generateLevel(nextLvl);
    setGameState(prev => ({ 
      ...prev, 
      level: nextLvl,
      lines: levelData.lines,
      victory: false,
      showVictorySummary: false,
      hearts: INITIAL_HEARTS,
      activeItems: { removeMode: false, guideLines: false },
      clearedPoints: [],
      currentMask: levelData.mask
    }));
    setFailedLines(new Set());
    setBouncingLine({id: '', count: 0, distance: 0});
    setResetKey(prev => prev + 1);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [gameState.level]);

  const handleLineClick = (lineId: string) => {
    if (totalDrag.current > 10) return;
    if (gameState.gameOver || gameState.victory) return;

    const line = gameState.lines.find(l => l.id === lineId);
    if (!line) return;

    // Item: Remove Mode
    if (gameState.activeItems.removeMode) {
      removeLine(lineId);
      setGameState(prev => ({ ...prev, activeItems: { ...prev.activeItems, removeMode: false } }));
      return;
    }

    // Normal Click: Check Blocked
    const blockDistance = getBlockingDistance(line, gameState.lines, gameState.gridSize);
    if (blockDistance !== -1) {
      setBouncingLine(prev => ({ id: lineId, count: prev.id === lineId ? prev.count + 1 : 1, distance: blockDistance }));
      setTimeout(() => setBouncingLine(prev => prev.id === lineId ? { id: '', count: 0, distance: 0 } : prev), 350);
      
      if (!failedLines.has(lineId)) {
        setFailedLines(prev => new Set(prev).add(lineId));
        setGameState(prev => {
          const newHearts = prev.hearts - 1;
          return { ...prev, hearts: Math.max(0, newHearts), gameOver: newHearts <= 0 };
        });
      }

      if (settings.vibration && window.navigator.vibrate) {
        window.navigator.vibrate(200);
      }
    } else {
      moveLineOut(lineId);
    }
  };

  const moveLineOut = (lineId: string) => {
    setGameState(prev => {
      const lineToMove = prev.lines.find(l => l.id === lineId);
      if (!lineToMove) return prev;

      const vec = getDirectionVector(lineToMove.direction);
      const newLines = prev.lines.map(l => {
        if (l.id === lineId) {
          const head = l.points[l.points.length - 1];
          // We add the exit trajectory to the path so pathOffset/pathLength work for slithering
          const exitPoint = { 
            x: head.x + vec.x * 30, 
            y: head.y + vec.y * 30 
          };
          return { ...l, isExiting: true, points: [...l.points, exitPoint] };
        }
        return l;
      });
      return { ...prev, lines: newLines };
    });

    setTimeout(() => {
      setGameState(prev => {
        const lineToRemove = prev.lines.find(l => l.id === lineId);
        if (!lineToRemove) return prev;
        
        const remainingLines = prev.lines.filter(l => l.id !== lineId);
        const originalPoints = lineToRemove.points.slice(0, -1);
        const newClearedPoints = [...prev.clearedPoints, ...originalPoints];
        
        if (remainingLines.length === 0) {
          handleLevelComplete();
        }
        return { 
          ...prev, 
          lines: remainingLines,
          clearedPoints: newClearedPoints 
        };
      });
    }, 800);
  };

  const removeLine = (lineId: string) => {
    setGameState(prev => {
      const lineToRemove = prev.lines.find(l => l.id === lineId);
      const remainingLines = prev.lines.filter(l => l.id !== lineId);
      const newClearedPoints = lineToRemove ? [...prev.clearedPoints, ...lineToRemove.points] : prev.clearedPoints;

      if (remainingLines.length === 0) {
        handleLevelComplete();
      }
      return { 
        ...prev, 
        lines: remainingLines,
        clearedPoints: newClearedPoints
      };
    });
  };

  const useHint = () => {
    const solvable = gameState.lines.find(l => !isBlocked(l, gameState.lines, gameState.gridSize));
    if (solvable) {
      setGameState(prev => ({ 
        ...prev, 
        activeItems: { ...prev.activeItems, hint: solvable.id } 
      }));
      // Auto-move into focus logic could go here
      setTimeout(() => {
        setGameState(prev => ({ 
          ...prev, 
          activeItems: { ...prev.activeItems, hint: undefined } 
        }));
      }, 2000);
    }
  };

  // Drag and Scroll Zoom/Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    totalDrag.current = 0;
  };

  const getConstrainedPan = (nextX: number, nextY: number, currentZoom: number) => {
    if (!containerRef.current || gameState.currentMask.length === 0) return { x: nextX, y: nextY };
    
    const rect = containerRef.current.getBoundingClientRect();
    const cellSize = 32;

    // Find bounding box of the pattern
    let minPx = 999;
    let maxPx = -999;
    let minPy = 999;
    let maxPy = -999;

    for (const p of gameState.currentMask) {
       if (p.x < minPx) minPx = p.x;
       if (p.x > maxPx) maxPx = p.x;
       if (p.y < minPy) minPy = p.y;
       if (p.y > maxPy) maxPy = p.y;
    }

    const boardCenter = (gameState.gridSize * cellSize) / 2;

    // Distance from board center to pattern edges (scaled by zoom)
    const offsetXMin = (minPx * cellSize - boardCenter) * currentZoom;
    const offsetXMax = ((maxPx + 1) * cellSize - boardCenter) * currentZoom;
    const offsetYMin = (minPy * cellSize - boardCenter) * currentZoom;
    const offsetYMax = ((maxPy + 1) * cellSize - boardCenter) * currentZoom;

    // Calculate minimum visible amount
    const patternWidth = offsetXMax - offsetXMin;
    const patternHeight = offsetYMax - offsetYMin;
    
    // Require at least 25% of the pattern or 80px (whichever is smaller) to remain visible
    const visibleThresholdX = Math.min(rect.width / 2, patternWidth / 4, 80);
    const visibleThresholdY = Math.min(rect.height / 2, patternHeight / 4, 80);

    const minX = visibleThresholdX - rect.width / 2 - offsetXMax;
    const maxX = rect.width / 2 - offsetXMin - visibleThresholdX;
    
    const minY = visibleThresholdY - rect.height / 2 - offsetYMax;
    const maxY = rect.height / 2 - offsetYMin - visibleThresholdY;
    
    return {
      x: Math.min(Math.max(nextX, minX), maxX),
      y: Math.min(Math.max(nextY, minY), maxY)
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current && containerRef.current) {
      totalDrag.current += Math.abs(e.movementX) + Math.abs(e.movementY);
      setPan(prev => getConstrainedPan(prev.x + e.movementX, prev.y + e.movementY, zoom));
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      const delta = e.deltaY * -0.005;
      setZoom(prev => {
         const nextZoom = Math.min(Math.max(prev + delta, 0.4), 3);
         // Also constrain pan when zooming out so it doesn't trap the view
         setPan(currentPan => getConstrainedPan(currentPan.x, currentPan.y, nextZoom));
         return nextZoom;
      });
    } else {
      setPan(prev => getConstrainedPan(prev.x - e.deltaX, prev.y - e.deltaY, zoom));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      totalDrag.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && lastTouch.current) {
      const dx = e.touches[0].clientX - lastTouch.current.x;
      const dy = e.touches[0].clientY - lastTouch.current.y;
      totalDrag.current += Math.abs(dx) + Math.abs(dy);
      setPan(prev => getConstrainedPan(prev.x + dx, prev.y + dy, zoom));
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F172A] flex flex-col font-sans select-none overflow-hidden text-slate-50">
      {/* Top HUD */}
      <header className="h-24 px-8 flex items-center justify-between z-30 bg-slate-900/60 backdrop-blur-2xl border-b border-slate-800 shadow-none">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-all hover:scale-105 active:scale-95"
          >
            <Settings className="w-5 h-5 text-slate-300" />
          </button>
          <button 
            onClick={restartLevel}
            className="p-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-all hover:scale-105 active:scale-95"
          >
            <RotateCcw className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase mb-1">Level {gameState.level}</span>
          <div className="flex items-center bg-slate-800/50 px-5 py-2.5 rounded-2xl border border-slate-700/50 gap-3">
            {[...Array(INITIAL_HEARTS)].map((_, i) => (
              <motion.div
                key={i}
                initial={false}
                animate={{ scale: i < gameState.hearts ? 1 : 0.8, opacity: i < gameState.hearts ? 1 : 0.2 }}
              >
                <Heart className={`w-6 h-6 ${i < gameState.hearts ? 'fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'text-slate-600'}`} />
              </motion.div>
            ))}
          </div>
        </div>

        <div className="w-24 hidden md:block" /> {/* Spacer */}
      </header>

      {/* Surface Area */}
      <main 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onPointerDown={e => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
      >
        <motion.div
          animate={{ x: pan.x, y: pan.y, scale: zoom }}
          transition={{ type: 'spring', damping: 25, stiffness: 180, mass: 0.8 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="relative pointer-events-auto" key={resetKey}>
             <Board 
               gameState={gameState} 
               failedLines={failedLines}
               bouncingLine={bouncingLine}
               onLineClick={handleLineClick}
             />
          </div>
        </motion.div>
      </main>

      {/* Items Rail */}
      <footer className="h-32 flex items-center justify-center gap-8 z-30 bg-slate-900/80 backdrop-blur-2xl border-t border-slate-800 shadow-none">
        <ItemButton 
          icon={<Lightbulb className="w-6 h-6" />} 
          label="Hint" 
          onClick={useHint} 
        />
        <ItemButton 
          icon={<Eraser className="w-6 h-6" />} 
          label="Remove" 
          active={gameState.activeItems.removeMode}
          onClick={() => setGameState(prev => ({ 
            ...prev, 
            activeItems: { ...prev.activeItems, removeMode: !prev.activeItems.removeMode } 
          }))} 
        />
        <ItemButton 
          icon={<Grid3X3 className="w-6 h-6" />} 
          label="Guide" 
          active={gameState.activeItems.guideLines}
          onClick={() => setGameState(prev => ({ 
            ...prev, 
            activeItems: { ...prev.activeItems, guideLines: !prev.activeItems.guideLines } 
          }))} 
        />
      </footer>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {isSettingsOpen && (
          <Modal onClose={() => setIsSettingsOpen(false)} title="Settings">
            <div className="p-8 space-y-8">
              <SettingRow 
                 icon={settings.volume ? <Volume2 /> : <VolumeX />} 
                 label="Audio" 
                 active={settings.volume} 
                 onToggle={() => setSettings(s => ({ ...s, volume: !s.volume }))} 
              />
              <SettingRow 
                 icon={<Smartphone />} 
                 label="Haptics" 
                 active={settings.vibration} 
                 onToggle={() => setSettings(s => ({ ...s, vibration: !s.vibration }))} 
              />
              <div className="pt-4 space-y-3">
                <button 
                    onClick={() => { restartLevel(); setIsSettingsOpen(false); }}
                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
                >
                    <RotateCcw className="w-5 h-5" />
                    Reset Level
                </button>
                <button 
                    className="w-full py-4 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                    onClick={() => setIsSettingsOpen(false)}
                >
                    Back to Game
                </button>
              </div>
            </div>
          </Modal>
        )}

        {gameState.gameOver && (
          <Modal title="Oh No!" hideClose>
            <div className="p-8 text-center bg-slate-900">
              <div className="w-24 h-24 bg-red-950/30 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-[-6deg] border border-red-900/20">
                <X className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-black mb-2 uppercase tracking-tight text-slate-100">Game Over</h3>
              <p className="text-slate-400 mb-10 text-sm leading-relaxed px-4">Don't give up! Every puzzle is a lesson in patience.</p>
              <div className="space-y-4">
                <button 
                  onClick={restartLevel}
                  className="w-full py-5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-black transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-sky-900/20"
                >
                  TRY AGAIN
                </button>
                <button 
                  className="w-full py-5 bg-slate-800 border-2 border-slate-700/50 hover:bg-slate-700 rounded-2xl font-black transition-all flex items-center justify-center gap-3 text-slate-200"
                  onClick={() => setGameState(prev => ({ ...prev, hearts: INITIAL_HEARTS, gameOver: false }))}
                >
                  <Play className="w-5 h-5 fill-current" />
                  REVIVE (AD)
                </button>
              </div>
            </div>
          </Modal>
        )}

        {gameState.showVictorySummary && (
          <Modal title="Solved!" hideClose>
            <div className="p-8 text-center bg-slate-900">
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                className="w-24 h-24 bg-sky-500 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-sky-900/20"
              >
                <div className="relative">
                    <Play className="w-10 h-10 fill-current ml-1" />
                    <motion.div 
                        animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="absolute inset-0 bg-white rounded-full"
                    />
                </div>
              </motion.div>
              <h3 className="text-2xl font-black mb-1 text-slate-100 uppercase">Success</h3>
              <p className="text-slate-400 mb-10 text-sm font-medium tracking-wide">LEVEL {gameState.level} COMPLETED</p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-slate-800 border border-slate-700/50 rounded-3xl shadow-none">
                      <div className="text-[10px] font-bold text-slate-500 mb-1">HEARTS</div>
                      <div className="text-lg font-black text-red-500">{gameState.hearts}/{INITIAL_HEARTS}</div>
                  </div>
                  <div className="p-4 bg-slate-800 border border-slate-700/50 rounded-3xl shadow-none">
                      <div className="text-[10px] font-bold text-slate-500 mb-1">SCORE</div>
                      <div className="text-lg font-black text-sky-400">{gameState.level * 100}</div>
                  </div>
              </div>

              <button 
                onClick={nextLevel}
                className="w-full py-5 bg-sky-600 hover:bg-sky-500 text-white rounded-[1.5rem] font-black transition-all hover:scale-[1.05] active:scale-95 shadow-lg shadow-sky-900/20 flex items-center justify-center gap-3"
              >
                CONTINUE
                <ChevronRight className="w-6 h-6 border-2 border-white/30 rounded-full" />
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Board({ gameState, onLineClick, failedLines, bouncingLine }: { 
  gameState: GameState, 
  onLineClick: (id: string) => void,
  failedLines: Set<string>,
  bouncingLine: {id: string, count: number, distance: number}
}) {
  const cellSize = 32;
  const boardSize = gameState.gridSize * cellSize;

  return (
    <svg 
      width={boardSize} 
      height={boardSize} 
      viewBox={`0 0 ${boardSize} ${boardSize}`}
      className="overflow-visible drop-shadow-2xl"
    >
      {/* Victory Pulse Overlay */}
      <AnimatePresence>
        {gameState.victory && (
          <motion.g
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.4, 0], scale: [0.8, 1.2, 1.5] }}
            transition={{ duration: 1, repeat: 2, ease: "easeOut" }}
          >
            <circle cx={boardSize/2} cy={boardSize/2} r={boardSize/2} fill="url(#victoryGradient)" />
          </motion.g>
        )}
      </AnimatePresence>

      <defs>
        <radialGradient id="victoryGradient">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Grid Dots (Entire pattern) */}
      <g>
        {gameState.currentMask.map((p, i) => (
          <circle 
            key={`dot-${i}`}
            cx={p.x * cellSize + cellSize / 2} 
            cy={p.y * cellSize + cellSize / 2} 
            r={2} 
            fill="rgba(71,85,105,0.4)" 
          />
        ))}
      </g>

      {/* Interactive Lines */}
      {gameState.lines.map(line => (
        <Line 
          key={line.id} 
          line={line} 
          cellSize={cellSize} 
          onClick={() => onLineClick(line.id)}
          isFailed={failedLines.has(line.id)}
          isBouncing={bouncingLine.id === line.id}
          bounceCount={bouncingLine.id === line.id ? bouncingLine.count : 0}
          bounceDistance={bouncingLine.id === line.id ? bouncingLine.distance : 0}
          isHinted={gameState.activeItems.hint === line.id}
          guideLines={gameState.activeItems.guideLines}
          gridSize={gameState.gridSize}
        />
      ))}
    </svg>
  );
}

function Line({ line, cellSize, onClick, isFailed, isBouncing, bounceCount, bounceDistance, isHinted, guideLines, gridSize }: { 
  line: LineSegment, 
  cellSize: number, 
  onClick: () => void,
  isFailed: boolean,
  isBouncing: boolean,
  bounceCount: number,
  bounceDistance: number,
  isHinted: boolean,
  guideLines: boolean,
  gridSize: number,
  key?: string
}) {
  const actualPoints = line.isExiting ? line.points.slice(0, -1) : line.points;
  // Arrow Head Point (The Tip)
  const headPoint = actualPoints[actualPoints.length - 1];
  // The point just before the head to determine final segment direction
  const prevPoint = actualPoints[actualPoints.length - 2];
  
  const vec = getDirectionVector(line.direction);
  
  // Calculate exact angle based on the final segment points
  let calculatedAngle = { 'up': 0, 'right': 90, 'down': 180, 'left': 270 }[line.direction] || 0;
  if (prevPoint && headPoint) {
    const dx = headPoint.x - prevPoint.x;
    const dy = headPoint.y - prevPoint.y;
    if (dx > 0) calculatedAngle = 90;
    else if (dx < 0) calculatedAngle = 270;
    else if (dy > 0) calculatedAngle = 180;
    else if (dy < 0) calculatedAngle = 0;
  }
  
  const extLengthPx = line.isExiting ? 30 * cellSize : 0;
  
  // Calculate bounce extension
  const bounceOffsetCells = Math.max(0.4, bounceDistance - 1);
  const bounceExtPx = bounceOffsetCells * cellSize;
  
  const extHeadPoint = {
      x: headPoint.x + vec.x * bounceOffsetCells,
      y: headPoint.y + vec.y * bounceOffsetCells
  };

  const exitingPoint = line.isExiting ? line.points[line.points.length - 1] : null;
  const pathPoints = [...actualPoints];
  if (exitingPoint) pathPoints.push(exitingPoint);
  else if (isBouncing) pathPoints.push(extHeadPoint);

  const d = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * cellSize + cellSize/2} ${p.y * cellSize + cellSize/2}`).join(' ');

  // Calculate pixel length for slither animation (using actual points)
  let bodyLengthPx = 0;
  for (let i = 0; i < actualPoints.length - 1; i++) {
    const dx = Math.abs(actualPoints[i+1].x - actualPoints[i].x);
    const dy = Math.abs(actualPoints[i+1].y - actualPoints[i].y);
    bodyLengthPx += (dx + dy) * cellSize;
  }
  
  const totalLengthPx = bodyLengthPx + Math.max(30 * cellSize, bounceExtPx);
  
  // Staggered entrance delay built from ID
  const lineDelay = parseInt(line.id.split('-')[1] || "0") * 0.01;

  // Add large buffer to dasharray gap to prevent repeating artifacts
  const dashArray = `${bodyLengthPx} ${totalLengthPx * 2 + 1000}`;

  const currentExtPx = line.isExiting ? extLengthPx : isBouncing ? bounceExtPx : 0;

  return (
    <motion.g
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="cursor-pointer group pointer-events-auto"
    >
      {/* Ghost Guide Line */}
      {guideLines && !line.isExiting && (
        <line 
           x1={headPoint.x * cellSize + cellSize/2}
           y1={headPoint.y * cellSize + cellSize/2}
           x2={(headPoint.x + vec.x * gridSize) * cellSize + cellSize/2}
           y2={(headPoint.y + vec.y * gridSize) * cellSize + cellSize/2}
           stroke="#38BDF8"
           strokeWidth={2}
           strokeDasharray="4 4"
           opacity={0.15}
        />
      )}

      {/* Main Line Body */}
      <motion.path
        d={d}
        stroke={isFailed ? '#ef4444' : isHinted ? '#38BDF8' : '#cbd5e1'}
        strokeWidth={10}
        strokeLinecap="round" // RESTORE ROUND CAP
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={dashArray}
        initial={{ strokeDashoffset: bodyLengthPx }} // Starts hidden (dash pushed back to tail)
        animate={line.isExiting ? { 
            strokeDashoffset: -extLengthPx // Tail perfectly slithers to the old head position!
        } : isBouncing ? {
            strokeDashoffset: [0, -bounceExtPx, 0]
        } : { 
            strokeDashoffset: 0
        }}
        transition={line.isExiting ? { 
            duration: 0.8, 
            ease: "linear" 
        } : isBouncing ? {
            duration: 0.35, ease: "easeInOut"
        } : { 
            duration: 0.25, 
            ease: "easeOut",
            delay: lineDelay 
        }}
        className="transition-colors duration-300"
      />

      {/* Arrow Head (Drawn on top) */}
      <motion.g
        initial={{ 
            scale: 0,
            x: headPoint.x * cellSize + cellSize/2, 
            y: headPoint.y * cellSize + cellSize/2 
        }}
        animate={line.isExiting ? { 
            x: headPoint.x * cellSize + cellSize/2 + vec.x * cellSize * 30, 
            y: headPoint.y * cellSize + cellSize/2 + vec.y * cellSize * 30,
            scale: 1
        } : isBouncing ? {
            x: [
                headPoint.x * cellSize + cellSize/2, 
                headPoint.x * cellSize + cellSize/2 + vec.x * bounceExtPx,
                headPoint.x * cellSize + cellSize/2
            ],
            y: [
                headPoint.y * cellSize + cellSize/2, 
                headPoint.y * cellSize + cellSize/2 + vec.y * bounceExtPx,
                headPoint.y * cellSize + cellSize/2
            ],
            scale: 1
        } : { 
            x: headPoint.x * cellSize + cellSize/2, 
            y: headPoint.y * cellSize + cellSize/2,
            scale: isHinted ? [1, 1.2, 1] : 1
        }}
        transition={line.isExiting ? { 
            duration: 0.8, ease: "linear" 
        } : isBouncing ? {
            duration: 0.35, ease: "easeInOut"
        } : { 
            x: { duration: 0.3 },
            y: { duration: 0.3 },
            scale: { duration: 0.3, type: "spring", bounce: 0.5, delay: lineDelay + 0.15 }
        }}
      >
        {/* Inner g to handle rotation cleanly around center */}
        <g transform={`rotate(${calculatedAngle})`}>
          <path
            d="M -12 6 L 0 -12 L 12 6 Z"
            fill={isFailed ? '#ef4444' : isHinted ? '#38BDF8' : '#cbd5e1'}
            stroke={isFailed ? '#ef4444' : isHinted ? '#38BDF8' : '#cbd5e1'}
            strokeWidth={3}
            strokeLinejoin="round"
            className="transition-colors duration-300"
          />
        </g>
      </motion.g>

      {/* Hitbox */}
      {!line.isExiting && (
        <path 
          d={d} 
          stroke="transparent" 
          strokeWidth={cellSize * 0.9} 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          fill="none"
        />
      )}

      {/* Glow effect for hint */}
      {isHinted && !line.isExiting && (
        <motion.circle 
            cx={headPoint.x * cellSize + cellSize/2}
            cy={headPoint.y * cellSize + cellSize/2}
            animate={{ r: [cellSize*0.4, cellSize*0.7, cellSize*0.4], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            fill="#38BDF8"
            className="pointer-events-none"
        />
      )}
    </motion.g>
  );
}

function ItemButton({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-3 group"
    >
      <div 
        className={`w-[70px] h-[70px] flex items-center justify-center rounded-3xl border-2 transition-all duration-300 shadow-none ${
          active 
          ? 'bg-sky-500 border-sky-400 text-white scale-110' 
          : 'bg-slate-800/80 border-slate-700/50 text-slate-400 hover:border-sky-400 hover:bg-slate-800 active:scale-90'
        }`}
      >
        {icon}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${active ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
        {label}
      </span>
    </button>
  );
}

function Modal({ children, title, onClose, hideClose }: { children: React.ReactNode, title: string, onClose?: () => void, hideClose?: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden"
      >
        <div className="px-8 pt-8 flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">{title}</h2>
          {!hideClose && (
            <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function SettingRow({ icon, label, active, onToggle }: { icon: React.ReactNode, label: string, active: boolean, onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-5">
        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-700/50">
          {icon}
        </div>
        <span className="font-semibold text-slate-200">{label}</span>
      </div>
      <button 
        onClick={onToggle}
        className={`w-14 h-8 rounded-full p-1.5 transition-all duration-500 ${active ? 'bg-sky-600' : 'bg-slate-700'}`}
      >
        <motion.div 
          animate={{ x: active ? 24 : 0 }}
          className="w-5 h-5 bg-slate-50 rounded-full shadow-md"
        />
      </button>
    </div>
  );
}
