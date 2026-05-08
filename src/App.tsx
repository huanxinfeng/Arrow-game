/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Star, 
  RotateCcw, 
  Settings, 
  X,
  Volume2,
  VolumeX,
  Smartphone,
  ChevronRight,
  Tv,
  Music,
  Crown
} from 'lucide-react';
import { GameState, LineSegment, Point, Direction } from './types';
import { generateLevel } from './lib/levelGenerator';
import { isBlocked, getDirectionVector, getBlockingDistance } from './lib/utils';
import { playSound, setMusicEnabled, setSoundEnabled, audioAssets } from './lib/audio';
import confetti from 'canvas-confetti';

// Import custom PNG icons
import musicOnIcon from './icons/music_on.png';
import musicOffIcon from './icons/music_off.png';
import soundOnIcon from './icons/sound_on.png';
import soundOffIcon from './icons/sound_off.png';
import vibrationOnIcon from './icons/vibration_on.png';
import vibrationOffIcon from './icons/vibration_off.png';
import removeAdIcon from './icons/removead.png';
import closeIcon from './icons/close.png';
import iconAds from './icons/icon_ads.png';
import starIcon from './icons/star.png';
import adIcon from './icons/ad.png';
import fingerIcon from './icons/finger.png';

import { 
  auth, 
  loginWithGoogle, 
  logout, 
  saveUserData, 
  getUserData, 
  logEvent,
  logAnalyticsEvent
} from './services/firebaseService';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

const INITIAL_HEARTS = 3;
const EXIT_DURATION = 0.35;
const EXIT_DISTANCE = 30;

const getInitialGameState = (): GameState => {
  const saved = localStorage.getItem('arrow_flow_gameState');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        gridSize: 30,
        lines: [],
        hearts: INITIAL_HEARTS,
        level: parsed.level || 1,
        gameOver: false,
        victory: false,
        showVictorySummary: false,
        activeItems: {
          removeMode: false,
          eraserInstructions: false,
          guideLines: false,
        },
        items: parsed.items || {
          hint: 0,
          eraser: 0,
          guide: 0,
        },
        guideActiveInLevel: false,
        clearedPoints: [],
        currentMask: [],
        tutorialClicked: parsed.tutorialClicked || false,
      };
    } catch (e) {
      console.warn("Failed to parse saved game state, starting fresh.", e);
    }
  }
  return {
    gridSize: 30,
    lines: [],
    hearts: INITIAL_HEARTS,
    level: 1,
    gameOver: false,
    victory: false,
    showVictorySummary: false,
    activeItems: {
      removeMode: false,
      eraserInstructions: false,
      guideLines: false,
    },
    items: {
      hint: 0,
      eraser: 0,
      guide: 0,
    },
    guideActiveInLevel: false,
    clearedPoints: [],
    currentMask: [],
    tutorialClicked: false,
  };
};

const getInitialSettings = () => {
  const saved = localStorage.getItem('arrow_flow_settings');
  if (saved) {
    try {
      return { music: true, sound: true, vibration: true, isAdsRemoved: false, ...JSON.parse(saved) };
    } catch (e) {
      console.warn("Failed to parse saved settings, using defaults.", e);
    }
  }
  return { music: true, sound: true, vibration: true, isAdsRemoved: false };
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(getInitialGameState);

  const isTransitioning = useRef(false);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.64);
  const [introZoom, setIntroZoom] = useState<number[] | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRemoveAdsOpen, setIsRemoveAdsOpen] = useState(false);
  const [settings, setSettings] = useState(getInitialSettings);
  const [failedLines, setFailedLines] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bouncingLine, setBouncingLine] = useState<{id: string, count: number, distance: number, duration?: number}>({id: '', count: 0, distance: 0});
  const [resetKey, setResetKey] = useState(0);
  const [centerOffset, setCenterOffset] = useState({ x: 0, y: 0 });
  const [clickEffects, setClickEffects] = useState<{ id: number; x: number; y: number }[]>([]);

  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  useEffect(() => {
    logAnalyticsEvent('app_start');
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setIsSyncing(true);
        const cloudData = await getUserData(u.uid);
        if (cloudData) {
          setGameState(prev => ({
            ...prev,
            level: cloudData.level || prev.level,
            items: cloudData.items || prev.items,
            tutorialClicked: cloudData.tutorialClicked || prev.tutorialClicked,
          }));
          if (cloudData.settings) {
            setSettings(prev => ({ ...prev, ...cloudData.settings }));
          }
        }
        setIsSyncing(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const data = {
      level: gameState.level,
      items: gameState.items,
      tutorialClicked: gameState.tutorialClicked
    };
    localStorage.setItem('arrow_flow_gameState', JSON.stringify(data));
    if (user && !isSyncing) {
      saveUserData(user.uid, data);
    }
  }, [gameState.level, gameState.items, gameState.tutorialClicked, user, isSyncing]);

  useEffect(() => {
    localStorage.setItem('arrow_flow_settings', JSON.stringify(settings));
    if (user && !isSyncing) {
      saveUserData(user.uid, { settings });
    }
  }, [settings, user, isSyncing]);

  // Requirement: Pure centering on mask content
  useEffect(() => {
    setMusicEnabled(settings.music);
    setSoundEnabled(settings.sound);

    let handleInteraction: () => void;
    if (settings.music) {
      handleInteraction = () => {
        if (settings.music && audioAssets.bgm.paused) {
          audioAssets.bgm.play().catch(() => {});
        }
        document.removeEventListener('pointerdown', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
        document.removeEventListener('click', handleInteraction);
      };
      document.addEventListener('pointerdown', handleInteraction, { once: true });
      document.addEventListener('touchstart', handleInteraction, { once: true });
      document.addEventListener('click', handleInteraction, { once: true });
    }

    return () => {
      if (handleInteraction) {
        document.removeEventListener('pointerdown', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
        document.removeEventListener('click', handleInteraction);
      }
    };
  }, [settings.music, settings.sound]);

  useEffect(() => {
    if (gameState.currentMask.length === 0) return;

    const cellSize = 32;
    let minX = 999, maxX = -999, minY = 999, maxY = -999;
    for (const p of gameState.currentMask) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const contentCenterX = ((minX + maxX) / 2 + 0.5) * cellSize;
    const contentCenterY = ((minY + maxY) / 2 + 0.5) * cellSize;
    const boardCenter = (gameState.gridSize * cellSize) / 2;

    // This is the offset needed relative to the board's own coordinate system
    setCenterOffset({ 
      x: boardCenter - contentCenterX, 
      y: boardCenter - contentCenterY 
    });
  }, [gameState.currentMask, gameState.gridSize]);

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
    if (user) {
      logEvent(user.uid, 'level_logs', { level: gameState.level, action: 'start' });
    }
  }, [gameState.level]);

  // Intro zoom sequence when level is mounted or restarted
  useEffect(() => {
    if (gameState.victory) return;

    const standardZoom = 0.64;
    setZoom(standardZoom);

    // Disable intro zoom for level 1 tutorial
    if (gameState.level === 1) {
      setIntroZoom(null);
      return;
    }

    if (containerRef.current && gameState.currentMask.length > 0) {
      const cellSize = 32;
      const rect = containerRef.current.getBoundingClientRect();
      const minDim = Math.min(rect.width, rect.height);
      
      // Calculate content bounding box
      let minX = 999, maxX = -999, minY = 999, maxY = -999;
      for (const p of gameState.currentMask) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const contentWidth = (maxX - minX + 1) * cellSize;
      const contentHeight = (maxY - minY + 1) * cellSize;

      // We want content to take up ~85% of viewport dimension in "full scale" view
      const scaleX = (rect.width * 0.85) / contentWidth;
      const scaleY = (rect.height * 0.85) / contentHeight;
      const fullScale = Math.min(scaleX, scaleY);
      
      // REQUIREMENT: If it already fits comfortably at standardZoom, don't zoom
      if (contentWidth * standardZoom <= rect.width * 0.95 && contentHeight * standardZoom <= rect.height * 0.95) {
        setIntroZoom(null);
        return;
      }

      // Perform a smooth curve sequence [start, zoomOutToSeeEverything, backToStart]
      // Distribution: Peak at 0.75 (3/4 of time zooming out, 1/4 zooming back in)
      setIntroZoom([standardZoom, fullScale, standardZoom]);
      
      const animDuration = 2200; // Total 2.2s
      const t1 = setTimeout(() => {
        setIntroZoom(null);
      }, animDuration);

      return () => clearTimeout(t1);
    }
  }, [resetKey, gameState.currentMask, gameState.gridSize, gameState.victory]);

  const nextLevel = useCallback(() => {
    setGameState(prev => {
      // Prevent double increment if nextLevel is called twice rapidly
      if (prev.victory === false && prev.clearedPoints.length > 0) {
        // This is a transition call, continue
      } else if (prev.victory === true) {
        // Already in victory state, maybe called twice
      }
      
      const nextLvl = prev.level + 1;
      const levelData = generateLevel(nextLvl);
      
      // Gifting 1 item each at level 4
      const newItems = { ...prev.items };
      if (nextLvl === 4) {
        newItems.hint = 1;
        newItems.eraser = 1;
        newItems.guide = 1;
      }

      return { 
        ...prev, 
        level: nextLvl,
        lines: levelData.lines,
        victory: false,
        showVictorySummary: false,
        hearts: INITIAL_HEARTS,
        activeItems: { removeMode: false, eraserInstructions: false, guideLines: false },
        guideActiveInLevel: false,
        clearedPoints: [],
        currentMask: levelData.mask,
        items: newItems,
        tutorialClicked: false,
      };
    });
    setFailedLines(new Set());
    setBouncingLine({id: '', count: 0, distance: 0});
    setResetKey(prev => prev + 1);
    setPan({ x: 0, y: 0 });
    isTransitioning.current = false;
  }, []);

  const handleLevelComplete = useCallback(() => {
    if (gameState.victory || isTransitioning.current) return;
    isTransitioning.current = true;
    
    if (user) {
      logEvent(user.uid, 'level_logs', { level: gameState.level, action: 'win', heartsRemaining: gameState.hearts });
    }
    logAnalyticsEvent('level_win', { level: gameState.level, hearts_left: gameState.hearts });
    // Safety timeout to ensure transition lock is eventually cleared
    const safetyTimeout = setTimeout(() => {
      isTransitioning.current = false;
    }, 5000);

    setPan({ x: 0, y: 0 });
    playSound('win');
    
    if (containerRef.current) {
      setGameState(prev => {
        const cellSize = 32;
        const rect = containerRef.current!.getBoundingClientRect();
        const minDim = Math.min(rect.width, rect.height);

        // Calculate content bounding box from mask
        let minX = 999, maxX = -999, minY = 999, maxY = -999;
        for (const p of prev.currentMask) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const contentWidth = (maxX - minX + 1) * cellSize;
        const contentHeight = (maxY - minY + 1) * cellSize;
        const contentDim = Math.max(contentWidth, contentHeight);

        // REQUIREMENT: If default size (0.64) <= 80% screen width, stay at 0.64. Otherwise scale to 80%.
        const standardZoom = 0.64;
        let scaleVal = standardZoom;
        if (contentDim * standardZoom > minDim * 0.8) {
          scaleVal = (minDim * 0.8) / contentDim;
        }

        setZoom(scaleVal); 
        return { 
          ...prev, 
          victory: true, 
          showVictorySummary: false,
        };
      });
    } else {
      setGameState(prev => ({ 
        ...prev, 
        victory: true, 
        showVictorySummary: false,
      }));
    }

    // Trigger confetti from bottom left and right
    const count = 180;
    
    // Safely attempt to use custom shape for rounded rects if supported, otherwise fallback to circles
    let shapes: any[] = ['square', 'circle'];
    if (typeof (confetti as any).shapeFromPath === 'function') {
      // Centered at (0,0) so it rotates properly around its own axis
      const roundedSquare = (confetti as any).shapeFromPath({ 
        path: 'M-4-4h8a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-8a2 2 0 012-2z' 
      });
      const roundedRect = (confetti as any).shapeFromPath({
        path: 'M-3-6h6a2 2 0 012 2v8a2 2 0 01-2 2h-6a2 2 0 01-2-2v-8a2 2 0 012-2z'
      });
      shapes = [roundedSquare, roundedRect, 'circle'];
    }

    const defaults = { 
      origin: { y: 1 }, 
      zIndex: 100,
      shapes: shapes,
      decay: 0.89,
      colors: ['#4B61DE', '#ffffff', '#22d3ee', '#fbbf24', '#f87171', '#a78bfa', '#34d399']
    };
    function fire(particleRatio: number, opts: any) {
      confetti(Object.assign({}, defaults, opts, {
        particleCount: Math.floor(count * particleRatio)
      }));
    }
    
    // Left
    fire(0.25, { spread: 26, startVelocity: 65, angle: 60, origin: { x: -0.15 } });
    fire(0.2, { spread: 60, startVelocity: 70, angle: 60, origin: { x: -0.15 } });
    fire(0.1, { spread: 100, startVelocity: 55, angle: 60, origin: { x: -0.15 }, scalar: 0.8 });
    
    // Right
    fire(0.25, { spread: 26, startVelocity: 65, angle: 120, origin: { x: 1.15 } });
    fire(0.2, { spread: 60, startVelocity: 70, angle: 120, origin: { x: 1.15 } });
    fire(0.1, { spread: 100, startVelocity: 55, angle: 120, origin: { x: 1.15 }, scalar: 0.8 });

    // Wait and go to next level
    setTimeout(() => {
        nextLevel();
    }, 3200);
  }, [gameState.gridSize, nextLevel]);

  const restartLevel = useCallback(() => {
    if (user) {
      logEvent(user.uid, 'level_logs', { level: gameState.level, action: 'restart' });
    }
    setGameState(prev => {
      const levelData = generateLevel(prev.level);
      return { 
        ...prev, 
        lines: levelData.lines, 
        hearts: INITIAL_HEARTS, 
        gameOver: false, 
        victory: false, 
        showVictorySummary: false,
        activeItems: { removeMode: false, eraserInstructions: false, guideLines: false },
        guideActiveInLevel: false,
        clearedPoints: [],
        currentMask: levelData.mask
      };
    });
    setFailedLines(new Set());
    setBouncingLine({id: '', count: 0, distance: 0});
    setResetKey(prev => prev + 1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Level completion check
  useEffect(() => {
    if (gameState.lines.length === 0 && !gameState.victory && gameState.clearedPoints.length > 0) {
      handleLevelComplete();
    }
  }, [gameState.lines.length, gameState.victory, gameState.clearedPoints.length, handleLevelComplete]);

  const handleLineClick = (lineId: string, customGridPos?: { x: number, y: number }) => {
    if (totalDrag.current > 10) return;
    if (gameState.gameOver || gameState.victory || isTransitioning.current) return;

    if (gameState.activeItems.hint) {
      setGameState(prev => ({ ...prev, activeItems: { ...prev.activeItems, hint: undefined } }));
    }

    let targetLineId = lineId;

    // Advanced overlap resolution if grid position is provided
    if (customGridPos) {
      const candidates = gameState.lines.map(line => ({
        line,
        dist: getDistanceToLine(customGridPos.x, customGridPos.y, line)
      })).filter(c => c.dist < 0.8);

      if (candidates.length > 0) {
        const unblocked = candidates.filter(c => !isBlocked(c.line, gameState.lines, gameState.gridSize));
        if (unblocked.length > 0) {
          unblocked.sort((a, b) => a.dist - b.dist);
          targetLineId = unblocked[0].line.id;
        } else {
          candidates.sort((a, b) => a.dist - b.dist);
          targetLineId = candidates[0].line.id;
        }
      }
    }

    const line = gameState.lines.find(l => l.id === targetLineId);
    if (!line) {
      if (gameState.activeItems.removeMode) {
        setGameState(prev => ({ ...prev, activeItems: { ...prev.activeItems, removeMode: false } }));
      }
      return;
    }

    // Tutorial dismissal
    if (gameState.level === 1 && !gameState.tutorialClicked) {
      setGameState(prev => ({ ...prev, tutorialClicked: true }));
    }

    // Item: Remove Mode
    if (gameState.activeItems.removeMode) {
      setGameState(prev => ({ 
        ...prev, 
        items: { ...prev.items, eraser: Math.max(0, prev.items.eraser - 1) },
        activeItems: { ...prev.activeItems, removeMode: false } 
      }));
      if (user) {
        logEvent(user.uid, 'item_usage_logs', { level: gameState.level, itemType: 'eraser' });
      }
      logAnalyticsEvent('item_use', { level: gameState.level, item: 'eraser' });
      moveLineOut(targetLineId);
      return;
    }

    // Normal Click: Check Blocked
    const blockDistance = getBlockingDistance(line, gameState.lines, gameState.gridSize);
    
    if (blockDistance !== -1) {
      const bounceOffsetCells = Math.max(0.4, blockDistance - 1);
      const calculatedDuration = (bounceOffsetCells * 2) / (EXIT_DISTANCE / EXIT_DURATION);
      const bounceTimeMs = Math.max(120, calculatedDuration * 1000); 

      setBouncingLine(prev => ({ id: targetLineId, count: prev.id === targetLineId ? prev.count + 1 : 1, distance: blockDistance, duration: bounceTimeMs / 1000 }));
      setTimeout(() => setBouncingLine(prev => prev.id === targetLineId ? { id: '', count: 0, distance: 0 } : prev), bounceTimeMs);
      
      if (!failedLines.has(targetLineId)) {
        setFailedLines(prev => new Set(prev).add(targetLineId));
        setGameState(prev => {
          const newHearts = prev.hearts - 1;
          const isOver = newHearts <= 0;
          if (isOver && user) {
            logEvent(user.uid, 'level_logs', { level: prev.level, action: 'fail' });
          }
          if (isOver) {
            logAnalyticsEvent('level_fail', { level: prev.level });
          }
          return { ...prev, hearts: Math.max(0, newHearts), gameOver: isOver };
        });
      }

      if (settings.sound) {
          playSound('error');
      }
      if (settings.vibration && window.navigator.vibrate) {
        window.navigator.vibrate(200);
      }
    } else {
      moveLineOut(targetLineId);
    }
  };

  const moveLineOut = (lineId: string) => {
    playSound('click');
    if (settings.vibration && window.navigator.vibrate) {
      window.navigator.vibrate(15);
    }
    setGameState(prev => {
      const lineToMove = prev.lines.find(l => l.id === lineId);
      if (!lineToMove) return prev;

      const vec = getDirectionVector(lineToMove.direction);
      const newLines = prev.lines.map(l => {
        if (l.id === lineId) {
          const head = l.points[l.points.length - 1];
          // We add the exit trajectory to the path so pathOffset/pathLength work for slithering
          const exitPoint = { 
            x: head.x + vec.x * EXIT_DISTANCE, 
            y: head.y + vec.y * EXIT_DISTANCE 
          };
          return { ...l, isExiting: true, points: [...l.points, exitPoint] };
        }
        return l;
      });

      // Show dots immediately on valid removal
      // lineToMove here is the original line without the exitPoint appended,
      // so all of its points are valid coordinates that formed the snake.
      const originalPoints = lineToMove.points;
      const newClearedPoints = [...prev.clearedPoints, ...originalPoints];

      const activeLines = newLines.filter(l => !l.isExiting);
      return { ...prev, lines: newLines, clearedPoints: newClearedPoints };
    });

    setTimeout(() => {
      setGameState(prev => {
        const remainingLines = prev.lines.filter(l => l.id !== lineId);
        return { 
          ...prev, 
          lines: remainingLines
        };
      });
    }, EXIT_DURATION * 1000);
  };

  const useHint = () => {
    if (gameState.items.hint <= 0) {
      // Logic to trigger "Watch Ad" could go here, or just increment for the demo
      return;
    }

    const solvableLines = gameState.lines.filter(l => !isBlocked(l, gameState.lines, gameState.gridSize));
    
    if (solvableLines.length > 0) {
      const solvable = solvableLines[Math.floor(Math.random() * solvableLines.length)];
      if (user) {
        logEvent(user.uid, 'item_usage_logs', { level: gameState.level, itemType: 'hint' });
      }
      logAnalyticsEvent('item_use', { level: gameState.level, item: 'hint' });
      // 1. Deduct item
      setGameState(prev => ({
        ...prev,
        items: { ...prev.items, hint: prev.items.hint - 1 },
        activeItems: { ...prev.activeItems, hint: solvable.id }
      }));

      // 2. Check if the snake is in view
      if (containerRef.current) {
        const cellSize = 32;
        const rect = containerRef.current.getBoundingClientRect();
        
        // Find the center of the target snake
        let minX = 999, maxX = -999, minY = 999, maxY = -999;
        solvable.points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });

        const snakeCenterX = ((minX + maxX) / 2 + 0.5) * cellSize;
        const snakeCenterY = ((minY + maxY) / 2 + 0.5) * cellSize;
        const boardCenter = (gameState.gridSize * cellSize) / 2;

        // Ideal pan to center the snake in the container
        const targetX = -(snakeCenterX - boardCenter) * zoom;
        const targetY = -(snakeCenterY - boardCenter) * zoom;

        // Check if the snake is already visible in the viewport
        const screenX = rect.width / 2 + (snakeCenterX - boardCenter) * zoom + pan.x;
        const screenY = rect.height / 2 + (snakeCenterY - boardCenter) * zoom + pan.y;

        const padding = 20; // Reduced padding for better visibility check
        const isVisible = (
          screenX > padding && screenX < rect.width - padding &&
          screenY > padding && screenY < rect.height - padding
        );

        if (!isVisible) {
          setPan(getConstrainedPan(targetX, targetY, zoom));
        }
      }

      // 3. (REMOVED) Clear hint after delay - Now handled in handleArrowClick
    }
  };

  const toggleEraser = () => {
    if (gameState.activeItems.removeMode) {
      setGameState(prev => ({
        ...prev,
        activeItems: { ...prev.activeItems, removeMode: false, eraserInstructions: false }
      }));
      return;
    }

    if (gameState.items.eraser <= 0) return;

    // Enter remove mode WITHOUT consuming item (consumption happens on successful click)
    setGameState(prev => ({
      ...prev,
      activeItems: { ...prev.activeItems, removeMode: true, eraserInstructions: false }
    }));
  };

  // Keep startEraserMode around just in case referenced, but inactive
  const startEraserMode = () => {};

  const toggleGuide = () => {
    setGameState(prev => {
      const isCurrentlyOn = prev.activeItems.guideLines;
      const isPaid = prev.guideActiveInLevel;

      if (isCurrentlyOn) {
        return { ...prev, activeItems: { ...prev.activeItems, guideLines: false } };
      }

      // Turning it on
      if (isPaid) {
        return { ...prev, activeItems: { ...prev.activeItems, guideLines: true } };
      }

      // Not paid, check items
      if (prev.items.guide <= 0) return prev;

      if (user) {
        logEvent(user.uid, 'item_usage_logs', { level: prev.level, itemType: 'guide' });
      }
      logAnalyticsEvent('item_use', { level: prev.level, item: 'guide' });

      return {
        ...prev,
        items: { ...prev.items, guide: prev.items.guide - 1 },
        guideActiveInLevel: true,
        activeItems: { ...prev.activeItems, guideLines: true }
      };
    });
  };

  const handleAreaClick = (e: React.MouseEvent) => {
    if (totalDrag.current > 10) return;
    
    // REQUIREMENT: Clicking background cancels Eraser mode
    if (gameState.activeItems.removeMode) {
      setGameState(prev => ({ ...prev, activeItems: { ...prev.activeItems, removeMode: false } }));
    }

    // Check if click is on top HUD area (exclude top 100px)
    if (e.clientY < 100) return;

    // Check if we clicked on an item button specifically (ignoring icons)
    // We can do this by checking if the target is within an element that should block the effect
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    const id = Date.now();
    setClickEffects(prev => [...prev.slice(-4), { id, x: e.clientX, y: e.clientY }]);
  };

  const watchAd = (itemKey: keyof GameState['items']) => {
    // Simulate watching an ad
    setGameState(prev => ({
      ...prev,
      items: { ...prev.items, [itemKey]: prev.items[itemKey] + 1 }
    }));
  };

  // Drag and Scroll Zoom/Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    totalDrag.current = 0;
  };

  const getConstrainedPan = (nextX: number, nextY: number, currentZoom: number) => {
    if (!containerRef.current) return { x: nextX, y: nextY };
    
    const rect = containerRef.current.getBoundingClientRect();
    const limitX = rect.width / 2;
    const limitY = rect.height / 2;
    
    return {
      x: Math.min(Math.max(nextX, -limitX), limitX),
      y: Math.min(Math.max(nextY, -limitY), limitY)
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current && containerRef.current) {
      totalDrag.current += Math.abs(e.movementX) + Math.abs(e.movementY);
      if (gameState.level !== 1) {
        setPan(prev => getConstrainedPan(prev.x + e.movementX, prev.y + e.movementY, zoom));
      }
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (gameState.level === 1) return;
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
      if (gameState.level !== 1) {
        setPan(prev => getConstrainedPan(prev.x + dx, prev.y + dy, zoom));
      }
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1C1E2B] font-sans select-none overflow-hidden text-slate-50">
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
        onClick={handleAreaClick}
        className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
      >
        <motion.div
          animate={{ 
            x: pan.x, 
            y: pan.y, 
            scale: introZoom !== null ? introZoom : zoom 
          }}
          transition={introZoom !== null ? { 
            duration: 2.2, 
            ease: "easeInOut",
            times: [0, 0.75, 1] 
          } : { 
            type: 'spring', damping: gameState.victory ? 18 : 25, stiffness: gameState.victory ? 40 : 180, mass: gameState.victory ? 1.2 : 0.8 
          }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div 
            className="relative pointer-events-auto" 
            key={resetKey}
            style={{ 
              transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)` 
            }}
          >
             <Board 
               gameState={gameState} 
               failedLines={failedLines}
               bouncingLine={bouncingLine}
               onLineClick={handleLineClick}
               isIntro={introZoom !== null}
               exitDuration={EXIT_DURATION}
               exitDistance={EXIT_DISTANCE}
             />
          </div>
        </motion.div>
      </main>

      {/* Top HUD */}
      <AnimatePresence>
        {!gameState.victory && (
          <motion.header 
            initial={{ y: -120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -120, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute top-0 left-0 right-0 h-[calc(96px+env(safe-area-inset-top))] px-6 md:px-8 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between z-40 bg-[#1C1E2B] pointer-events-none"
          >
            <div className={`flex items-center gap-3 ${gameState.level === 1 ? 'invisible pointer-events-none' : 'pointer-events-auto'}`}>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="group relative w-[48px] h-[48px] flex items-center justify-center"
              >
                <div className="relative w-[42px] h-[42px]">
                  {/* 按钮厚度底 */}
                  <div className="absolute inset-0 bg-[#242946] rounded-xl translate-y-[3px]" />
                  {/* 按钮正面 */}
                  <div className="relative w-full h-full flex items-center justify-center bg-[#2E3458] rounded-xl group-active:translate-y-[3px] transition-transform duration-75">
                    <div className="w-[38px] h-[38px] flex items-center justify-center">
                      <PauseIcon className="w-full h-full" />
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex flex-col items-center pointer-events-auto">
              <span className="text-sm font-black text-[#5692fa] mb-1">Level {gameState.level}</span>
              <div className="flex items-center gap-2">
                {[...Array(INITIAL_HEARTS)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={false}
                    animate={{ scale: 1, opacity: i < gameState.hearts ? 1 : 0.4 }}
                  >
                    <StarIcon active={i < gameState.hearts} className="w-9 h-9 md:w-11 md:h-11" />
                  </motion.div>
                ))}
              </div>
            </div>

            <div className={`flex items-center gap-3 ${gameState.level === 1 ? 'invisible pointer-events-none' : 'pointer-events-auto'}`}>
              <button 
                onClick={restartLevel}
                className="group relative w-[48px] h-[48px] flex items-center justify-center"
              >
                <div className="relative w-[42px] h-[42px]">
                  {/* 按钮厚度底 */}
                  <div className="absolute inset-0 bg-[#242946] rounded-xl translate-y-[3px]" />
                  {/* 按钮正面 */}
                  <div className="relative w-full h-full flex items-center justify-center bg-[#2E3458] rounded-xl group-active:translate-y-[3px] transition-transform duration-75">
                    <div className="w-[38px] h-[38px] flex items-center justify-center">
                      <RestartIcon className="w-full h-full" />
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Items Rail */}
      <AnimatePresence>
        {!gameState.victory && gameState.level >= 4 && (
          <motion.div 
            initial={{ y: 130, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 130, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-8 z-40 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2 pointer-events-none"
          >
            <ItemButton 
              icon={<HintIcon className="w-12 h-12 md:w-[60px] md:h-[60px]" />} 
              label="提示" 
              count={gameState.items.hint}
              onClick={useHint} 
              onAdClick={() => watchAd('hint')}
            />
            <ItemButton 
              icon={<EraserIcon className="w-12 h-12 md:w-[60px] md:h-[60px]" />} 
              label="橡皮擦" 
              count={gameState.items.eraser}
              active={gameState.activeItems.removeMode}
              onClick={toggleEraser} 
              onAdClick={() => watchAd('eraser')}
            />
            <ItemButton 
              icon={<GridIcon className="w-12 h-12 md:w-[60px] md:h-[60px]" />} 
              label="引导" 
              count={gameState.items.guide}
              showZeroBadge={gameState.items.guide === 0 && gameState.guideActiveInLevel}
              active={gameState.activeItems.guideLines}
              onClick={toggleGuide} 
              onAdClick={() => watchAd('guide')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level 1 Tutorial Text & Finger */}
      <AnimatePresence>
        {gameState.level === 1 && !gameState.victory && !gameState.tutorialClicked && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-none z-40"
            >
              <span className="text-[20px] font-black text-[#428EFF]">Tap to move</span>
            </motion.div>
            
            {/* Absolute positioned finger over SVG area */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center"
            >
               <motion.img 
                  src={fingerIcon}
                  className="w-[102px] h-[102px]"
                  style={{
                    // Align tip with the tail of middle yellow arrow.
                    // Moving the image right to align the top-left index finger to the center of the line.
                    transform: 'translate(45px, 100px)'
                  }}
                  animate={{
                    scale: [1, 0.9, 1],
                    y: [0, 10, 0]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  referrerPolicy="no-referrer"
               />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modals & Overlays */}
      <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
        <AnimatePresence>
          {clickEffects.map(eff => (
            <ClickEffect 
              key={eff.id} 
              x={eff.x} 
              y={eff.y} 
              onComplete={() => setClickEffects(prev => prev.filter(p => p.id !== eff.id))} 
            />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {gameState.activeItems.removeMode && (
          <motion.div 
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="absolute top-28 left-1/2 -translate-x-1/2 z-40 w-[288px] h-[68px] bg-[#353D6B] rounded-[12px] flex items-center px-4 shadow-[0_2px_0_#232950] pointer-events-none"
          >
            <div className="w-[60px] h-[60px] flex items-center justify-center shrink-0 mt-[-2px]">
              <EraserIcon className="w-full h-full" />
            </div>
            <div className="flex flex-col ml-2">
              <span className="text-[20px] font-black text-[#F0F7FF] leading-tight">Eraser</span>
              <span className="text-[16px] font-bold text-[#428EFF] leading-tight">Tap an arrow to remove</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pause" height={345}>
        <div className="p-6 text-[#2A2F56]">
          <div className="flex items-start justify-between w-full h-[60px] m-0 p-0 mx-auto">
                 <SquareToggle 
                   icon={<img src={settings.music ? musicOnIcon : musicOffIcon} className="w-full h-full object-contain" alt="music" referrerPolicy="no-referrer" />} 
                   active={settings.music} 
                   onToggle={() => setSettings(s => ({ ...s, music: !s.music }))} 
                 />
                 <SquareToggle 
                   icon={<img src={settings.sound ? soundOnIcon : soundOffIcon} className="w-full h-full object-contain" alt="sound" referrerPolicy="no-referrer" />} 
                   active={settings.sound} 
                   onToggle={() => setSettings(s => ({ ...s, sound: !s.sound }))} 
                 />
                 <SquareToggle 
                   icon={<img src={settings.vibration ? vibrationOnIcon : vibrationOffIcon} className="w-full h-full object-contain" alt="vibration" referrerPolicy="no-referrer" />} 
                   active={settings.vibration} 
                   onToggle={() => setSettings(s => {
                     const newVib = !s.vibration;
                     if (newVib && window.navigator.vibrate) {
                       window.navigator.vibrate(15);
                     }
                     return { ...s, vibration: newVib };
                   })} 
                 />
              </div>

              {!settings.isAdsRemoved && (
                <button 
                    onClick={() => { setIsRemoveAdsOpen(true); setIsSettingsOpen(false); }}
                    className="w-full bg-[#FF2398] text-white font-bold text-lg h-[48px] mt-[32px] mb-[20px] rounded-xl relative flex items-center pl-[16px] transition-all duration-75 shadow-[0_4px_0_#C6066F,0_7px_0_rgba(0,0,0,0.25)] active:translate-y-[4px] active:shadow-[0_0px_0_#C6066F,0_1px_0_rgba(0,0,0,0.25)]"
                >
                    <img src={removeAdIcon} className="w-[30px] h-[30px] object-contain shrink-0" alt="remove-ads" referrerPolicy="no-referrer" />
                    <span className="flex-1 text-center">Remove Ads</span>
                </button>
              )}
              <button 
                  className={`w-full bg-[#2982FF] text-white font-bold text-xl h-[48px] rounded-xl flex justify-center items-center transition-all duration-75 shadow-[0_4px_0_#0F61DA,0_7px_0_rgba(0,0,0,0.25)] active:translate-y-[4px] active:shadow-[0_0px_0_#0F61DA,0_1px_0_rgba(0,0,0,0.25)] ${settings.isAdsRemoved ? 'mt-[32px]' : ''}`}
                  onClick={() => setIsSettingsOpen(false)}
              >
                  Continue
              </button>
              
              <div className="mt-[24px] flex flex-col items-center gap-3 text-sm font-bold">
              <div className="flex justify-center mt-1">
                <a 
                  href="https://acoustic-daphne-732.notion.site/Arrow-Flow-35a8175a305b80f6b596c56220b5a921?source=copy_link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#65A9F7] text-sm underline hover:text-sky-300"
                >
                  Privacy Policy
                </a>
              </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isRemoveAdsOpen} onClose={() => { setIsRemoveAdsOpen(false); setIsSettingsOpen(true); }} title="Remove Ads" height={398}>
        <div className="p-4 text-center flex flex-col items-center h-full">
          <div className="w-[240px] h-[236px] bg-[#22264A] rounded-[12px] flex flex-col items-center justify-center mb-4 shrink-0">
            <div className="relative w-[114px] h-[114px] shrink-0 flex items-center justify-center mb-4">
               <img src={iconAds} className="w-full h-full object-contain drop-shadow-md" alt="Ads" referrerPolicy="no-referrer" />
            </div>
            
            <div className="text-left w-full px-[12px] text-[#5b89d4] font-bold text-[16px] leading-[20px]">
               <p className="w-[216px] mb-[4px]">- No more ads between levels</p>
               <p className="w-[216px] mb-[4px]">- Rewarded videos will be kept</p>
            </div>
          </div>
          <button 
              onClick={() => { 
                setSettings(s => ({ ...s, isAdsRemoved: true }));
                setIsRemoveAdsOpen(false); 
                setIsSettingsOpen(true); 
              }}
              className="mt-[8px] w-[168px] bg-[#5cc62e] text-white font-bold text-2xl h-[48px] shrink-0 rounded-xl flex justify-center items-center transition-all duration-75 shadow-[0_4px_0_#419b1b,0_7px_0_rgba(0,0,0,0.25)] active:translate-y-[4px] active:shadow-[0_0px_0_#419b1b,0_1px_0_rgba(0,0,0,0.25)]"
          >
              $ 4.99
          </button>
        </div>
      </Modal>

      <Modal isOpen={gameState.gameOver} title="Continue ?" hideClose height={368}>
        <div className="px-[12px] pb-[16px] pt-4 text-center">
          <div className="flex justify-center gap-[12px] mt-2 mb-2">
                 {[1,2,3].map(i => (
                   <img key={i} src={starIcon} className="w-[60px] h-[60px] object-contain drop-shadow-md" alt="star" referrerPolicy="no-referrer" />
                 ))}
              </div>
              <p className="text-[#bfd7ff] font-bold text-[16px] mb-[26px] mt-6 leading-tight">
                Watch an ad for more Stars to continue.
              </p>

              <button 
                onClick={() => { setGameState(prev => ({ ...prev, hearts: INITIAL_HEARTS, gameOver: false })) }}
                className="w-[222px] mx-auto bg-[#5cc62e] text-white font-bold text-[22px] h-[48px] rounded-[14px] relative flex items-center pl-[16px] mb-[20px] transition-all duration-75 shadow-[0_4px_0_#419b1b,0_7px_0_rgba(0,0,0,0.25)] active:translate-y-[4px] active:shadow-[0_0px_0_#419b1b,0_1px_0_rgba(0,0,0,0.25)]"
              >
                <img src={adIcon} className="w-[30px] h-[30px] object-contain drop-shadow-sm shrink-0" alt="ad" referrerPolicy="no-referrer" />
                <span className="flex-1 text-center">Play on</span>
              </button>
              <button 
            onClick={restartLevel}
            className="w-[222px] mx-auto bg-[#3b82f6] text-white font-bold text-[22px] h-[48px] rounded-[14px] flex justify-center items-center mb-1 transition-all duration-75 shadow-[0_4px_0_#2563eb,0_7px_0_rgba(0,0,0,0.25)] active:translate-y-[4px] active:shadow-[0_0px_0_#2563eb,0_1px_0_rgba(0,0,0,0.25)]"
          >
            Replay
          </button>
        </div>
      </Modal>

      {/* --- Privacy Policy Modal --- */}
      <AnimatePresence>
        {isPrivacyOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
            onClick={() => setIsPrivacyOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#252836] w-full max-w-md max-h-[80vh] rounded-[32px] p-8 flex flex-col overflow-hidden relative"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setIsPrivacyOpen(false)}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              <h2 className="text-3xl font-black text-white mb-6">Privacy Policy</h2>
              
              <div className="flex-1 overflow-y-auto text-slate-300 space-y-4 pr-2 text-sm leading-relaxed">
                <p>Welcome to Arrow Flow! Your privacy is important to us.</p>
                <h3 className="text-lg font-bold text-white mt-4">1. Information Collection</h3>
                <p>If you use Google Sync, we collect your unique user ID and basic profile info to save your progress. We do not sell your personal data.</p>
                <h3 className="text-lg font-bold text-white mt-4">2. Game Data</h3>
                <p>We store game progress, level attempts, and item usage to improve the player experience and provide cloud-save features.</p>
                <h3 className="text-lg font-bold text-white mt-4">3. Third-Party Services</h3>
                <p>Our game uses Firebase for analytics and cloud storage. Please check Firebase's privacy policy for details.</p>
                <p className="pt-4 text-xs text-slate-500">Last updated: May 2024</p>
              </div>

              <button 
                onClick={() => setIsPrivacyOpen(false)}
                className="mt-8 w-full bg-[#65A9F7] text-white font-black h-[64px] rounded-2xl shadow-[0_4px_0_0_#2D6DAD] active:translate-y-1 active:shadow-none transition-all"
              >
                CLOSE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const HintIcon = ({ className }: { className?: string }) => (
  <img src="/hint.png" className={className} alt="hint" referrerPolicy="no-referrer" />
);

const EraserIcon = ({ className }: { className?: string }) => (
  <img src="/eraser.png" className={className} alt="eraser" referrerPolicy="no-referrer" />
);

const GridIcon = ({ className }: { className?: string }) => (
  <img src="/grid.png" className={className} alt="grid" referrerPolicy="no-referrer" />
);

const AdIcon = ({ className }: { className?: string }) => (
  <img src="/ad.png" className={className} alt="ad" referrerPolicy="no-referrer" />
);

const PauseIcon = ({ className }: { className?: string }) => (
  <img src="/pause.png" className={className} alt="pause" referrerPolicy="no-referrer" />
);

const RestartIcon = ({ className }: { className?: string }) => (
  <img src="/restart.png" className={className} alt="restart" referrerPolicy="no-referrer" />
);

const StarIcon = ({ className, active }: { className?: string, active: boolean }) => (
  <img src={active ? "/star_fill.png" : "/star_empty.png"} className={className} alt="star" referrerPolicy="no-referrer" />
);

function getRoundedPathInfo(points: {x: number, y: number}[], cellSize: number, cornerRadius: number) {
  let d = "";
  let length = 0;

  if (points.length < 2) return { d, length: 0 };

  const corners: {x: number, y: number}[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = corners[corners.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    if (dx1 * dy2 !== dy1 * dx2) {
      corners.push(curr);
    }
  }
  corners.push(points[points.length - 1]);

  const projected = corners.map(p => ({
    x: p.x * cellSize + cellSize / 2,
    y: p.y * cellSize + cellSize / 2
  }));

  d += `M ${projected[0].x} ${projected[0].y}`;
  let lastX = projected[0].x;
  let lastY = projected[0].y;

  for (let i = 1; i < projected.length - 1; i++) {
    const prev = projected[i-1];
    const curr = projected[i];
    const next = projected[i+1];

    const d1x = curr.x - prev.x;
    const d1y = curr.y - prev.y;
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    const dir1x = d1x / len1;
    const dir1y = d1y / len1;

    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
    const dir2x = d2x / len2;
    const dir2y = d2y / len2;

    const r = Math.min(cornerRadius, len1 / 2, len2 / 2);

    const startX = curr.x - dir1x * r;
    const startY = curr.y - dir1y * r;

    const endX = curr.x + dir2x * r;
    const endY = curr.y + dir2y * r;

    d += ` L ${startX} ${startY}`;
    length += Math.sqrt((startX - lastX)**2 + (startY - lastY)**2);

    const cross = dir1x * dir2y - dir1y * dir2x;
    const sweep = cross > 0 ? 1 : 0; 
    
    d += ` A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`;
    length += (Math.PI * r) / 2;

    lastX = endX;
    lastY = endY;
  }

  const finalPt = projected[projected.length - 1];
  d += ` L ${finalPt.x} ${finalPt.y}`;
  length += Math.sqrt((finalPt.x - lastX)**2 + (finalPt.y - lastY)**2);

  return { d, length };
}

function getDistanceToLine(px: number, py: number, line: LineSegment): number {
  let minDistance = Infinity;
  for (let i = 0; i < line.points.length - 1; i++) {
    const p1 = line.points[i];
    const p2 = line.points[i+1];
    
    // Centers of cells are at .5
    const x1 = p1.x + 0.5;
    const y1 = p1.y + 0.5;
    const x2 = p2.x + 0.5;
    const y2 = p2.y + 0.5;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx*dx + dy*dy;
    
    if (l2 === 0) {
      const dist = Math.sqrt((px-x1)**2 + (py-y1)**2);
      if (dist < minDistance) minDistance = dist;
      continue;
    }
    
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const dist = Math.sqrt(
      (px - (x1 + t * dx))**2 + 
      (py - (y1 + t * dy))**2
    );
    if (dist < minDistance) minDistance = dist;
  }
  return minDistance;
}

function Board({ gameState, onLineClick, failedLines, bouncingLine, isIntro, exitDuration, exitDistance }: { 
  gameState: GameState, 
  onLineClick: (id: string, pos?: { x: number, y: number }) => void,
  failedLines: Set<string>,
  bouncingLine: {id: string, count: number, distance: number, duration?: number},
  isIntro: boolean,
  exitDuration: number,
  exitDistance: number
}) {
  const cellSize = 32;
  const boardSize = gameState.gridSize * cellSize;
  const svgRef = useRef<SVGSVGElement>(null);

  const handleBoardClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // We don't stop propagation because we want to allow handleLineClick 
    // to handle its own drag thresholding.
    if (!svgRef.current) return;
    
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgP = pt.matrixTransform(ctm.inverse());
    
    const gridX = svgP.x / cellSize;
    const gridY = svgP.y / cellSize;
    
    onLineClick("", { x: gridX, y: gridY });
  };

  return (
    <svg 
      ref={svgRef}
      width={boardSize} 
      height={boardSize} 
      viewBox={`0 0 ${boardSize} ${boardSize}`}
      className="overflow-visible drop-shadow-2xl outline-none"
      onClick={handleBoardClick}
    >
      {/* Grid Dots (Revealed points, plus full mask at the end) */}
      <g>
        {(() => {
          const pointsToRender = gameState.victory ? gameState.currentMask : gameState.clearedPoints;
          const seen = new Set<string>();
          const uniquePoints = pointsToRender.filter(p => {
            const key = `${p.x}-${p.y}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          return uniquePoints.map((p) => {
            const cx = (gameState.gridSize - 1) / 2;
            const cy = (gameState.gridSize - 1) / 2;
            // Chebyshev distance for concentric square rings (like the red-yellow-blue image)
            const dist = Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy));
            const delay = gameState.victory ? dist * 0.12 : 0;

            return (
              <motion.rect 
                key={`dot-${p.x}-${p.y}`}
                x={p.x * cellSize + cellSize / 2 - 4} 
                y={p.y * cellSize + cellSize / 2 - 4} 
                width={8}
                height={8}
                style={{ originX: "50%", originY: "50%" }}
                initial={{ scale: 0.8, rx: 4, opacity: 0 }}
                animate={gameState.victory ? { 
                    scale: [0.8, 1.8, 0], 
                    rx: [4, 0, 0],
                    fill: ["rgba(71,85,105,0.4)", "#4B61DE", "#4B61DE"],
                    opacity: [1, 1, 0]
                } : { 
                    scale: 0.8,
                    rx: 4,
                    fill: "rgba(71,85,105,0.4)",
                    opacity: 1
                }}
                transition={gameState.victory ? { 
                    duration: 0.8, 
                    delay: delay,
                    ease: "easeInOut",
                    times: [0, 0.4, 1]
                } : { 
                    duration: 0.4 
                }}
              />
            );
          });
        })()}
      </g>

      {/* Guide Lines */}
      {gameState.activeItems.guideLines && (
        <g>
          {gameState.lines.map(line => {
            if (line.isExiting) return null;
            const actualPoints = line.points;
            const headPoint = actualPoints[actualPoints.length - 1];
            const vec = getDirectionVector(line.direction);
            return (
              <line 
                key={`guide-${line.id}`}
                x1={headPoint.x * cellSize + cellSize/2}
                y1={headPoint.y * cellSize + cellSize/2}
                x2={(headPoint.x + vec.x * gameState.gridSize) * cellSize + cellSize/2}
                y2={(headPoint.y + vec.y * gameState.gridSize) * cellSize + cellSize/2}
                stroke="#2A2E4D"
                strokeWidth={8}
                className="pointer-events-none"
              />
            );
          })}
        </g>
      )}

      {/* Interactive Lines */}
      {gameState.lines.map(line => (
        <Line 
          key={line.id} 
          line={line} 
          cellSize={cellSize} 
          isFailed={failedLines.has(line.id)}
          isBouncing={bouncingLine.id === line.id}
          bounceCount={bouncingLine.id === line.id ? bouncingLine.count : 0}
          bounceDistance={bouncingLine.id === line.id ? bouncingLine.distance : 0}
          bounceDuration={bouncingLine.id === line.id ? (bouncingLine.duration || exitDuration) : 0}
          isHinted={gameState.activeItems.hint === line.id}
          guideLines={gameState.activeItems.guideLines}
          isEraserMode={gameState.activeItems.removeMode}
          gridSize={gameState.gridSize}
          isIntro={isIntro}
          exitDuration={exitDuration}
          exitDistance={exitDistance}
        />
      ))}

      {/* Tutorial finger for Level 1 removed from Board for better Z-index management */}
    </svg>
  );
}

function Line({ line, cellSize, isFailed, isBouncing, bounceCount, bounceDistance, bounceDuration, isHinted, isEraserMode, guideLines, gridSize, isIntro, exitDuration, exitDistance }: { 
  line: LineSegment, 
  cellSize: number, 
  isFailed: boolean,
  isBouncing: boolean,
  bounceCount: number,
  bounceDistance: number,
  bounceDuration: number,
  isHinted: boolean,
  isEraserMode?: boolean,
  guideLines: boolean,
  gridSize: number,
  isIntro: boolean,
  exitDuration: number,
  exitDistance: number,
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
  
  const extLengthPx = line.isExiting ? exitDistance * cellSize : 0;
  
  // Calculate bounce extension
  const bounceOffsetCells = Math.max(0.4, bounceDistance - 1);
  const bounceExtPx = bounceOffsetCells * cellSize;
  
  const extHeadPoint = {
      x: headPoint.x + vec.x * bounceOffsetCells,
      y: headPoint.y + vec.y * bounceOffsetCells
  };

  const exitingPoint = (line.isExiting && !line.isFlying) ? line.points[line.points.length - 1] : null;
  const pathPoints = [...actualPoints];
  if (exitingPoint) pathPoints.push(exitingPoint);
  else if (isBouncing) pathPoints.push(extHeadPoint);

  const cornerRadius = 8; // Tighter radius as requested
  const { d, length: fullPathLength } = getRoundedPathInfo(pathPoints, cellSize, cornerRadius);
  const { length: bodyLengthPx } = getRoundedPathInfo(actualPoints, cellSize, cornerRadius);
  
  // Staggered entrance delay built from ID
  const lineDelay = parseInt(line.id.split('-')[1] || "0") * 0.01;

  // Add large buffer to dasharray gap to prevent repeating artifacts
  const dashArray = `${bodyLengthPx} ${fullPathLength * 2 + 1000}`;

  const currentExtPx = line.isExiting ? extLengthPx : isBouncing ? bounceExtPx : 0;

  return (
    <motion.g
      className="cursor-pointer group pointer-events-auto"
      animate={line.isFlying ? {
        x: vec.x * cellSize * exitDistance,
        y: vec.y * cellSize * exitDistance,
        opacity: [1, 1, 0]
      } : {}}
      transition={line.isFlying ? {
        duration: exitDuration,
        ease: "easeIn"
      } : {}}
    >
      {/* Main Line Body */}
      <motion.path
        d={d}
        stroke={isFailed ? '#EEF9FF' : (line.color || '#cbd5e1')}
        strokeWidth={8}
        strokeLinecap="round" // RESTORE ROUND CAP
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={dashArray}
        initial={{ strokeDashoffset: bodyLengthPx }} // Starts hidden (dash pushed back to tail)
        animate={line.isFlying ? {
            strokeDashoffset: 0
        } : line.isExiting ? { 
            strokeDashoffset: -extLengthPx // Tail perfectly slithers to the old head position!
        } : isBouncing ? {
            strokeDashoffset: [0, -bounceExtPx, 0]
        } : { 
            strokeDashoffset: 0
        }}
        transition={line.isExiting ? { 
            duration: exitDuration, 
            ease: "easeInOut" 
        } : isBouncing ? {
            duration: bounceDuration, ease: "easeInOut"
        } : { 
            duration: isIntro ? 2.2 : 0.25,  // Sync with intro!
            ease: "easeInOut",
            delay: isIntro ? 0 : lineDelay 
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
        animate={line.isFlying ? {
            x: headPoint.x * cellSize + cellSize/2, 
            y: headPoint.y * cellSize + cellSize/2,
            scale: 1,
            opacity: 1
        } : line.isExiting ? { 
            x: headPoint.x * cellSize + cellSize/2 + vec.x * cellSize * exitDistance, 
            y: headPoint.y * cellSize + cellSize/2 + vec.y * cellSize * exitDistance,
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
            scale: 1
        }}
        transition={line.isExiting ? { 
            duration: exitDuration, ease: "easeInOut" 
        } : isBouncing ? {
            duration: bounceDuration, ease: "easeInOut"
        } : { 
            x: { duration: isIntro ? 2.2 : 0.3, ease: "easeInOut" },
            y: { duration: isIntro ? 2.2 : 0.3, ease: "easeInOut" },
            scale: { 
                duration: isIntro ? 2.2 : 0.3, 
                type: "spring", 
                bounce: 0.5, 
                delay: isIntro ? 0 : lineDelay + 0.15 
            }
        }}
      >
        {/* Inner g to handle rotation cleanly around center */}
        <g transform={`rotate(${calculatedAngle})`}>
          <path
            d="M -8 3 L 0 -8 L 8 3 Z"
            fill={isFailed ? '#EEF9FF' : (line.color || '#cbd5e1')}
            stroke={isFailed ? '#EEF9FF' : (line.color || '#cbd5e1')}
            strokeWidth={5.5}
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

      {/* Glow effect and Reference line for hint */}
      {isHinted && !line.isExiting && (
        <>
          <line 
            x1={headPoint.x * cellSize + cellSize/2}
            y1={headPoint.y * cellSize + cellSize/2}
            x2={(headPoint.x + vec.x * gridSize) * cellSize + cellSize/2}
            y2={(headPoint.y + vec.y * gridSize) * cellSize + cellSize/2}
            stroke={line.color || '#cbd5e1'}
            strokeWidth={8}
            opacity={0.5}
            strokeLinecap="round"
            className="pointer-events-none"
          />
          <motion.circle 
              cx={headPoint.x * cellSize + cellSize/2}
              cy={headPoint.y * cellSize + cellSize/2}
              animate={{ r: [cellSize*0.4, cellSize*0.8, cellSize*0.4], opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              fill={line.color || '#cbd5e1'}
              className="pointer-events-none"
          />
        </>
      )}
    </motion.g>
  );
}

function ItemButton({ icon, label, onClick, onAdClick, active, count, showZeroBadge }: { 
  icon: React.ReactNode, 
  label: string, 
  onClick: () => void, 
  onAdClick: () => void,
  active?: boolean,
  count: number,
  showZeroBadge?: boolean
}) {
  const isAd = count === 0 && !showZeroBadge;

  return (
    <div className="flex flex-col items-center pointer-events-auto">
      <button 
        onClick={isAd ? onAdClick : onClick}
        className="w-16 h-16 md:w-20 md:h-20 group relative"
      >
        {/* 按钮厚度底 (圆形) */}
        <div className="absolute inset-0 bg-[#232950] rounded-full translate-y-[4px]" />
        
        {/* 按钮正面 */}
        <div className={`absolute inset-0 flex items-center justify-center rounded-full transition-all duration-75 group-active:translate-y-[4px] ${
          active 
          ? 'bg-[#2172f3] text-white' 
          : 'bg-[#353D6B] text-[#7d8cc4]'
        }`}>
          {icon}
          
          {/* Badge Area (Moved inside front face to follow movement) */}
          {(count > 0 || showZeroBadge || isAd) && (
            <div className={`absolute -top-1 -right-1 text-white font-black w-[22px] h-[22px] rounded-full flex items-center justify-center shadow-lg z-20 ${isAd ? 'bg-[#3b82f6]' : 'bg-[#3b82f6] text-[14px]'}`}>
              {isAd ? <AdIcon className="w-4 h-4" /> : count}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

function Modal({ children, title, onClose, hideClose, isOpen, height = 382 }: { children: React.ReactNode, title: string, onClose?: () => void, hideClose?: boolean, isOpen: boolean, height?: number | string }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/75"
        >
          <div className="md:scale-[1.3] lg:scale-[1.5] transition-transform origin-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-[270px] relative"
              style={{ height, willChange: "transform, opacity", transform: "translateZ(0)" }}
            >
              {/* 弹窗底板厚度 (#1F2345) */}
          <div className="absolute inset-0 bg-[#1F2345] rounded-2xl translate-y-[3px]" />
          
          {/* 弹窗主体 */}
          <div className="relative h-full bg-[#2A2F56] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* 标题区域 + 标题厚度 (#22274F) */}
            <div className="h-[52px] bg-[#38407C] border-b-[2px] border-[#22274F] flex justify-center items-center relative shrink-0">
              <h2 className="text-[22px] font-black text-white capitalize">{title}</h2>
              {!hideClose && onClose && (
                <button onClick={onClose} className="absolute top-[4px] right-[4px] w-11 h-11 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform">
                  <img src={closeIcon} className="w-full h-full object-contain" alt="close" referrerPolicy="no-referrer" />
                </button>
              )}
            </div>
            
            <div className="flex-1 w-full overflow-hidden">
              {children}
            </div>
          </div>
        </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SquareToggle({ icon, active, onToggle }: { icon: React.ReactNode, active: boolean, onToggle: () => void }) {
  return (
    <button 
      onClick={onToggle}
      className={`w-[60px] h-[60px] rounded-[14px] transition-all duration-75 flex items-center justify-center relative active:translate-y-[4px] ${
        active 
          ? 'bg-[#2982FF] shadow-[0_4px_0_#0F61DA,0_7px_0_rgba(0,0,0,0.25)] active:shadow-[0_0px_0_#0F61DA,0_1px_0_rgba(0,0,0,0.25)]' 
          : 'bg-[#4B527E] shadow-[0_4px_0_#22274F,0_7px_0_rgba(0,0,0,0.25)] active:shadow-[0_0px_0_#22274F,0_1px_0_rgba(0,0,0,0.25)]'
      }`}
    >
      <div className="w-11 h-11 relative flex items-center justify-center pointer-events-none">
         {icon}
      </div>
    </button>
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

const ClickEffect = ({ x, y, onComplete }: { x: number; y: number; onComplete: () => void; key?: React.Key }) => {
  return (
    <div
      className="fixed pointer-events-none"
      style={{ left: x, top: y }}
    >
      {/* Expanding circle (underneath) */}
      <motion.div
        initial={{ width: 16, height: 16, opacity: 1 }}
        animate={{ width: 50, height: 50, opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        onAnimationComplete={onComplete}
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#95C1FF] bg-[#2982FF]"
      />
      {/* Center circle */}
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0 }}
        transition={{ 
          duration: 0.45, 
          ease: "easeOut"
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-[#95C1FF] bg-[#2982FF]"
      />
    </div>
  );
};
