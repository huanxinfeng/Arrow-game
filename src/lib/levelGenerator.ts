import { Point, Direction, LineSegment } from '../types';
import { getDirectionVector, isPointInList, isBlocked } from './utils';
import { SHAPE_PATTERNS, parsePattern } from './patterns';

const GRID_SIZE = 30;

// Simple seeded random generator (Mulberry32)
function seededRandom(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

let rng = seededRandom(1);
const random = () => rng();

function getShapeMask(type: string): Point[] {
  const pattern = SHAPE_PATTERNS[type];
  if (pattern) {
    return parsePattern(pattern);
  }

  // Fallback to legacy programmatic shapes if string pattern not found
  const points: Point[] = [];
  const centerX = 15;
  const centerY = 15;

  switch (type) {
    case 'heart':
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const dx = (x - centerX) / 10;
          const dy = (centerY - y) / 10;
          if (Math.pow(dx * dx + dy * dy - 1, 3) - dx * dx * Math.pow(dy, 3) <= 0) {
            points.push({ x, y });
          }
        }
      }
      break;
    default:
      for (let y = 10; y < 20; y++) {
        for (let x = 10; x < 20; x++) {
          points.push({ x, y });
        }
      }
  }
  return points;
}

const PALETTE = ['#20e15d', '#22d3ee', '#ff9500', '#2d7eff', '#9d35e7', '#f21c8d', '#ffc918'];

function assignColorsToLines(lines: LineSegment[]) {
  const N = lines.length;
  // Make colors scale with the number of lines
  let colorCount = 2;
  if (N <= 4) colorCount = 2;
  else if (N <= 8) colorCount = 3;
  else if (N <= 15) colorCount = 4;
  else if (N <= 25) colorCount = 5;
  else if (N <= 35) colorCount = 6;
  else colorCount = 7;

  // Pick `colorCount` random distinct colors from the palette
  const shuffledPalette = [...PALETTE].sort(() => random() - 0.5);
  const selectedColors = shuffledPalette.slice(0, colorCount);
  
  // To keep same colors clustered instead of scattered, sort lines by angle from center
  lines.forEach(l => {
     const pt = l.points[0];
     const cx = pt.x - 15;
     const cy = pt.y - 15;
     (l as any)._angle = Math.atan2(cy, cx);
  });
  
  const sortedLines = [...lines].sort((a, b) => (a as any)._angle - (b as any)._angle);
  
  sortedLines.forEach((line, i) => {
    // Assign segments to color blocks
    const colorIndex = Math.floor((i / sortedLines.length) * colorCount);
    line.color = selectedColors[colorIndex];
    delete (line as any)._angle;
  });
}

export function generateLevel(level: number): { lines: LineSegment[], gridSize: number, mask: Point[] } {
  // Hardcoded Tutorial Level 1
  if (level === 1) {
    const tutorialLines: LineSegment[] = [
      {
        id: 'tutorial-green',
        points: [{ x: 12, y: 17 }, { x: 12, y: 16 }, { x: 12, y: 15 }, { x: 12, y: 14 }, { x: 12, y: 13 }],
        direction: 'up',
        color: '#20e15d'
      },
      {
        id: 'tutorial-yellow',
        points: [{ x: 14, y: 17 }, { x: 14, y: 16 }, { x: 14, y: 15 }, { x: 14, y: 14 }, { x: 14, y: 13 }],
        direction: 'up',
        color: '#ffc918'
      },
      {
        id: 'tutorial-blue',
        points: [{ x: 16, y: 17 }, { x: 16, y: 16 }, { x: 16, y: 15 }, { x: 16, y: 14 }, { x: 16, y: 13 }],
        direction: 'up',
        color: '#2d7eff'
      }
    ];
    const tutorialMask: Point[] = [];
    tutorialLines.forEach(l => tutorialMask.push(...l.points));
    return { lines: tutorialLines, gridSize: GRID_SIZE, mask: tutorialMask };
  }

  // Hardcoded Level 2
  if (level === 2) {
    const level2Lines: LineSegment[] = [
      {
        id: 'l2-pink',
        points: [{ x: 14, y: 17 }, { x: 14, y: 16 }, { x: 14, y: 15 }, { x: 14, y: 14 }],
        direction: 'up',
        color: '#f21c8d' // Pink
      },
      {
        id: 'l2-green',
        points: [{ x: 15, y: 17 }, { x: 15, y: 16 }, { x: 15, y: 15 }, { x: 15, y: 14 }],
        direction: 'up',
        color: '#20e15d' // Green
      },
      {
        id: 'l2-cyan',
        points: [
          { x: 13, y: 17 }, { x: 13, y: 16 }, { x: 13, y: 15 }, { x: 13, y: 14 }, { x: 13, y: 13 },
          { x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 },
          { x: 16, y: 14 }, { x: 16, y: 15 }, { x: 16, y: 16 }, { x: 16, y: 17 }
        ],
        direction: 'down',
        color: '#22d3ee' // Cyan
      }
    ];
    const level2Mask: Point[] = [];
    level2Lines.forEach(l => level2Mask.push(...l.points));
    return { lines: level2Lines, gridSize: GRID_SIZE, mask: level2Mask };
  }

  // Hardcoded Level 3
  if (level === 3) {
    const level3Lines: LineSegment[] = [
      {
        id: 'l3-blue',
        points: [
          { x: 17, y: 14 }, { x: 17, y: 15 }, { x: 17, y: 16 }, { x: 17, y: 17 },
          { x: 16, y: 17 }, { x: 15, y: 17 }, { x: 14, y: 17 }, { x: 13, y: 17 },
          { x: 13, y: 16 }, { x: 13, y: 15 }, { x: 13, y: 14 }, { x: 13, y: 13 },
          { x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }
        ],
        direction: 'right',
        color: '#2d7eff' // Blue
      },
      {
        id: 'l3-pink',
        points: [
          { x: 14, y: 14 }, { x: 14, y: 15 }, { x: 15, y: 15 }
        ],
        direction: 'right',
        color: '#f21c8d' // Pink
      },
      {
        id: 'l3-yellow',
        points: [
          { x: 15, y: 14 }, { x: 16, y: 14 }, { x: 16, y: 15 }, { x: 16, y: 16 }, { x: 15, y: 16 }, { x: 14, y: 16 }
        ],
        direction: 'left',
        color: '#ffc918' // Yellow
      }
    ];
    const level3Mask: Point[] = [];
    level3Lines.forEach(l => level3Mask.push(...l.points));
    return { lines: level3Lines, gridSize: GRID_SIZE, mask: level3Mask };
  }

  // Initialize RNG with level seed
  rng = seededRandom(level + 12345); // offset to avoid too-obvious patterns

  const patternKeys = Object.keys(SHAPE_PATTERNS).filter(k => k !== 'tutorial' && k !== 'level2' && k !== 'level3');
  
  let shape = '';
  if (level === 2) shape = 'level2';
  else if (level === 3) shape = 'level3';
  else {
    shape = patternKeys[(level - 4) % patternKeys.length];
  }

  // Fallback to first if shape empty
  if (!shape) shape = patternKeys[0];

  const mask = getShapeMask(shape);
  const gridSize = GRID_SIZE;

  // Difficulty rhythm
  let targetFree = 2;
  let minLen = 5;
  let maxLen = 15;
  
  if (level <= 3) {
    targetFree = 4;
    minLen = 5;
    maxLen = 12;
  } else {
    // mostly medium, with occasional hard or very hard
    const cycle = level % 4; // 0, 1, 2, 3
    if (cycle === 1 || cycle === 2) {
      // Medium
      targetFree = 3; // Fewer arrows free initially
      minLen = 10;
      maxLen = 18;
    } else if (cycle === 3) {
      // Hard
      targetFree = 2;
      minLen = 15;
      maxLen = 25;
    } else {
      // Very Hard
      targetFree = 1; // Very few arrows free initially
      minLen = 20;
      maxLen = 40;
    }
  }

  const maxAttempts = 150; // Increased for finding harder levels
  let bestCandidate: { lines: LineSegment[], freeCount: number } | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidateLines = carveMaskIntoPaths(mask, minLen, maxLen);
    
    // assignDirectionsIfSolvable now returns { success, initialFreeCount }
    const result = assignDirectionsIfSolvable(candidateLines, gridSize);
    if (result.success) {
      const freeCount = result.initialFreeCount;

      // If we hit our perfect target, return immediately
      if (freeCount <= targetFree) {
        assignColorsToLines(candidateLines);
        return { lines: candidateLines, gridSize, mask };
      }

      // Record the 'stiffest' (hardest) valid layout found so far
      if (!bestCandidate || freeCount < bestCandidate.freeCount) {
        bestCandidate = { lines: candidateLines, freeCount };
      }
    }
  }

  // If we didn't find the perfect target within X tries, use the best one we did find
  if (bestCandidate) {
    assignColorsToLines(bestCandidate.lines);
    return { lines: bestCandidate.lines, gridSize, mask };
  }

  // Ultimate fallback (should be very rare)
  const fallbackLines = carveMaskIntoPaths(mask, minLen, maxLen);
  assignDirectionsIfSolvable(fallbackLines, gridSize, true);
  assignColorsToLines(fallbackLines);
  return { lines: fallbackLines, gridSize, mask };
}

function carveMaskIntoPaths(mask: Point[], minLen: number, maxLen: number): LineSegment[] {
  let lines: LineSegment[] = [];
  const remaining = new Set(mask.map(p => `${p.x},${p.y}`));
  let idCounter = 0;

  const getNeighbors = (p: Point, pool?: Set<string>) => [
    { x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y },
    { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }
  ].filter(n => (pool || remaining).has(`${n.x},${n.y}`));

  while (remaining.size > 0) {
    const pointsList = Array.from(remaining);
    let headCandidate: Point | null = null;
    let minNeighbors = 999;
    const candidates: Point[] = [];
    
    for (const sStr of pointsList) {
      const [px, py] = sStr.split(',').map(Number);
      const p = { x: px, y: py };
      const nl = getNeighbors(p).length;
      if (nl > 0) {
        if (nl < minNeighbors) {
          minNeighbors = nl;
          candidates.length = 0;
          candidates.push(p);
        } else if (nl === minNeighbors) {
          candidates.push(p);
        }
      }
    }

    if (candidates.length > 0) {
      headCandidate = candidates[Math.floor(random() * candidates.length)];
    }

    // No neighbor-heads found, but points remain? They are isolated islands.
    if (!headCandidate && pointsList.length > 0) {
      const [px, py] = pointsList[0].split(',').map(Number);
      const orphan = { x: px, y: py };
      remaining.delete(pointsList[0]);
      
      // Try to attach orphan to ANY adjacent line's head or tail
      let attached = false;
      for (const l of lines) {
        const start = l.points[0];
        const end = l.points[l.points.length - 1];
        if (Math.abs(start.x - orphan.x) + Math.abs(start.y - orphan.y) === 1) {
          l.points.unshift(orphan);
          attached = true;
          break;
        }
        if (Math.abs(end.x - orphan.x) + Math.abs(end.y - orphan.y) === 1) {
          l.points.push(orphan);
          attached = true;
          break;
        }
      }
      
      if (!attached) {
        // Discard isolated point to avoid length-1 snake
      }
      continue;
    }

    if (!headCandidate) break;

    remaining.delete(`${headCandidate.x},${headCandidate.y}`);
    const currentPoints: Point[] = [headCandidate];
    // Length based on difficulty rhythm
    const targetLen = Math.floor(random() * (maxLen - minLen + 1)) + minLen; 

    for (let i = 0; i < targetLen - 1; i++) {
        const last = currentPoints[currentPoints.length - 1];
        const neighbors = getNeighbors(last);
        if (neighbors.length === 0) break;

        let next: Point;
        if (currentPoints.length >= 2) {
            const prev = currentPoints[currentPoints.length - 2];
            const dx = last.x - prev.x;
            const dy = last.y - prev.y;
            const straightNeighbor = neighbors.find(n => n.x === last.x + dx && n.y === last.y + dy);
            
            if (straightNeighbor && random() < 0.95) {
                next = straightNeighbor;
            } else {
                next = neighbors[Math.floor(random() * neighbors.length)];
            }
        } else {
            next = neighbors[Math.floor(random() * neighbors.length)];
        }

        currentPoints.push(next);
        remaining.delete(`${next.x},${next.y}`);
    }

    // ENSURE LENGTH 2 MINIMUM: If we created a length 1 by accident, try to grow it or attach it
    if (currentPoints.length === 1) {
       const p = currentPoints[0];
       // This point lost its neighbors in the 'remaining' set during the loop, 
       // but it must have neighbors in 'mask' that are already in 'lines'.
       let attached = false;
       for (const l of lines) {
         const start = l.points[0];
         const end = l.points[l.points.length - 1];
         if (Math.abs(start.x - p.x) + Math.abs(start.y - p.y) === 1) {
           l.points.unshift(p);
           attached = true;
           break;
         }
         if (Math.abs(end.x - p.x) + Math.abs(end.y - p.y) === 1) {
           l.points.push(p);
           attached = true;
           break;
         }
       }
       if (!attached) {
         // Discard
       }
    } else {
       lines.push({ id: `line-${idCounter++}`, points: currentPoints, direction: 'right' });
    }
  }

  // --- AGGRESSIVE MERGING PASS ---
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < lines.length; i++) {
      for (let j = 0; j < lines.length; j++) {
        if (i === j) continue;
        const l1 = lines[i];
        const l2 = lines[j];
        if (!l1 || !l2) continue;

        const tryMerge = (a: LineSegment, b: LineSegment, aAtEnd: boolean, bAtStart: boolean): boolean => {
          const pA = aAtEnd ? a.points[a.points.length - 1] : a.points[0];
          const pB = bAtStart ? b.points[0] : b.points[b.points.length - 1];
          
          if (Math.abs(pA.x - pB.x) + Math.abs(pA.y - pB.y) === 1) {
            const ptsA = aAtEnd ? [...a.points] : [...a.points].reverse();
            const ptsB = bAtStart ? [...b.points] : [...b.points].reverse();
            
            // Check Collinearity first for clean look
            if (ptsA.length >= 2 && ptsB.length >= 2) {
              const prevA = ptsA[ptsA.length - 2];
              const nextB = ptsB[1];
              const dx1 = pA.x - prevA.x;
              const dy1 = pA.y - prevA.y;
              const dxBridge = pB.x - pA.x;
              const dyBridge = pB.y - pA.y;
              const dx2 = nextB.x - pB.x;
              const dy2 = nextB.y - pB.y;
              
              if (dx1 === dxBridge && dy1 === dyBridge && (dx1 === dx2 && dy1 === dy2)) {
                a.points = [...ptsA, ...ptsB];
                return true;
              }
            }

            // Also merge if one is short (< 6 segments) to reduce clutter even if it turns
            if (ptsA.length < 6 || ptsB.length < 6) {
               a.points = [...ptsA, ...ptsB];
               return true;
            }
          }
          return false;
        };

        if (tryMerge(l1, l2, true, true)) { lines.splice(j, 1); merged = true; break; }
        if (tryMerge(l1, l2, true, false)) { lines.splice(j, 1); merged = true; break; }
        if (tryMerge(l1, l2, false, true)) { lines.splice(j, 1); merged = true; break; }
        if (tryMerge(l1, l2, false, false)) { lines.splice(j, 1); merged = true; break; }
      }
      if (merged) break;
    }
  }

  return lines.filter(l => l.points.length >= 2);
}



function assignDirectionsIfSolvable(lines: LineSegment[], gridSize: number, forceAssignRemaining = false): { success: boolean, initialFreeCount: number } {
  const remainingIds = new Set<string>();
  const globalPoints = new Map<string, string>();
  let removablesThisStep: string[] = [];
  let initialFreeCount = 0;
  let isFirstStep = true;
  
  for (const l of lines) {
    if (l.points.length < 2) continue; 
    remainingIds.add(l.id);
    for (const p of l.points) {
      globalPoints.set(`${p.x},${p.y}`, l.id);
    }
  }
  
  const getDir = (head: Point, prev: Point): Direction => {
    const dx = head.x - prev.x;
    const dy = head.y - prev.y;
    if (dx > 0) return 'right';
    if (dx < 0) return 'left';
    if (dy > 0) return 'down';
    return 'up';
  };

  const getVector = (dir: Direction) => {
    switch (dir) {
      case 'up': return { x: 0, y: -1 };
      case 'down': return { x: 0, y: 1 };
      case 'left': return { x: -1, y: 0 };
      case 'right': return { x: 1, y: 0 };
    }
  };

  const linesMap = new Map(lines.map(l => [l.id, l]));

  const canExit = (lineId: string, endType: 'start' | 'end'): boolean => {
    const l = linesMap.get(lineId)!;
    const pts = l.points;
    const head = endType === 'end' ? pts[pts.length - 1] : pts[0];
    const prev = endType === 'end' ? pts[pts.length - 2] : pts[1];
    
    const dir = getDir(head, prev);
    const vec = getVector(dir);
    
    let curr = { x: head.x + vec.x, y: head.y + vec.y };
    while (curr.x >= 0 && curr.x < gridSize && curr.y >= 0 && curr.y < gridSize) {
      const pStr = `${curr.x},${curr.y}`;
      if (globalPoints.has(pStr)) {
        return false;
      }
      curr.x += vec.x;
      curr.y += vec.y;
    }
    return true; 
  };

  while (remainingIds.size > 0) {
    removablesThisStep = [];
    
    for (const lineId of remainingIds) {
      if (canExit(lineId, 'end')) {
        removablesThisStep.push(lineId);
      } else if (canExit(lineId, 'start')) {
        const l = linesMap.get(lineId)!;
        l.points.reverse(); 
        removablesThisStep.push(lineId);
      }
    }
    
    if (removablesThisStep.length === 0) {
      if (forceAssignRemaining) {
        for (const id of remainingIds) {
          const l = linesMap.get(id)!;
          l.direction = getDir(l.points[l.points.length-1], l.points[l.points.length-2]);
        }
      }
      return { success: false, initialFreeCount: 0 };
    }

    if (isFirstStep) {
      initialFreeCount = removablesThisStep.length;
      isFirstStep = false;
    }

    for (const id of removablesThisStep) {
      const l = linesMap.get(id)!;
      l.direction = getDir(l.points[l.points.length-1], l.points[l.points.length-2]);
      remainingIds.delete(id);
      for (const p of l.points) {
        globalPoints.delete(`${p.x},${p.y}`);
      }
    }
  }
  
  return { success: true, initialFreeCount };
}
