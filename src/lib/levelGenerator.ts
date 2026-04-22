import { Point, Direction, LineSegment } from '../types';
import { getDirectionVector, isPointInList, isBlocked } from './utils';
import { SHAPE_PATTERNS, parsePattern } from './patterns';

const GRID_SIZE = 30;

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

export function generateLevel(level: number): { lines: LineSegment[], gridSize: number, mask: Point[] } {
  const patternKeys = Object.keys(SHAPE_PATTERNS);
  const allShapes = [...patternKeys, 'heart'];
  
  const shape = allShapes[(level - 1) % allShapes.length];
  const mask = getShapeMask(shape);
  const gridSize = GRID_SIZE;

  const maxAttempts = 100; // Drastically reduced for performance
  let bestCandidate: { lines: LineSegment[], freeCount: number } | null = null;

  // Difficulty targets (Initial Removable Lines)
  let targetFree = 999;
  if (level >= 3 && level <= 5) targetFree = 6;
  if (level >= 6 && level <= 9) targetFree = 4;
  if (level >= 10) targetFree = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidateLines = carveMaskIntoPaths(mask);
    
    // assignDirectionsIfSolvable now returns { success, initialFreeCount }
    const result = assignDirectionsIfSolvable(candidateLines, gridSize);
    if (result.success) {
      const freeCount = result.initialFreeCount;

      // If we hit our perfect target, return immediately
      if (freeCount <= targetFree) {
        return { lines: candidateLines, gridSize, mask };
      }

      // Record the 'stiffest' (hardest) valid layout found so far
      if (!bestCandidate || freeCount < bestCandidate.freeCount) {
        bestCandidate = { lines: candidateLines, freeCount };
      }
    }
  }

  // If we didn't find the perfect target within 100 tries, use the best one we did find
  if (bestCandidate) {
    return { lines: bestCandidate.lines, gridSize, mask };
  }

  // Ultimate fallback
  const fallbackLines = carveMaskIntoPaths(mask);
  assignDirectionsIfSolvable(fallbackLines, gridSize, true);
  return { lines: fallbackLines, gridSize, mask };
}

function carveMaskIntoPaths(mask: Point[]): LineSegment[] {
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
      headCandidate = candidates[Math.floor(Math.random() * candidates.length)];
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
    // Minimum length 2, target up to 20
    const targetLen = Math.floor(Math.random() * 15) + 5; 

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
            
            if (straightNeighbor && Math.random() < 0.95) {
                next = straightNeighbor;
            } else {
                next = neighbors[Math.floor(Math.random() * neighbors.length)];
            }
        } else {
            next = neighbors[Math.floor(Math.random() * neighbors.length)];
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

            // Also merge if one is short (< 4 segments) to reduce clutter even if it turns
            if (ptsA.length < 4 || ptsB.length < 4) {
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
  const pathToPoints = new Map<string, Set<string>>();
  let removablesThisStep: string[] = [];
  let initialFreeCount = 0;
  let isFirstStep = true;
  
  for (const l of lines) {
    if (l.points.length < 2) continue; 
    remainingIds.add(l.id);
    pathToPoints.set(l.id, new Set(l.points.map(p => `${p.x},${p.y}`)));
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

  const canExit = (lineId: string, endType: 'start' | 'end'): boolean => {
    const l = lines.find(x => x.id === lineId)!;
    const pts = l.points;
    const head = endType === 'end' ? pts[pts.length - 1] : pts[0];
    const prev = endType === 'end' ? pts[pts.length - 2] : pts[1];
    
    const dir = getDir(head, prev);
    const vec = getVector(dir);
    
    let curr = { x: head.x + vec.x, y: head.y + vec.y };
    while (curr.x >= 0 && curr.x < gridSize && curr.y >= 0 && curr.y < gridSize) {
      for (const otherId of remainingIds) {
        if (otherId === lineId) continue;
        if (pathToPoints.get(otherId)?.has(`${curr.x},${curr.y}`)) {
          return false;
        }
      }
      curr.x += vec.x;
      curr.y += vec.y;
    }
    return true; 
  };

  while (remainingIds.size > 0) {
    removablesThisStep = [];
    
    for (const lineId of Array.from(remainingIds)) {
      if (canExit(lineId, 'end')) {
        removablesThisStep.push(lineId);
      } else if (canExit(lineId, 'start')) {
        const l = lines.find(x => x.id === lineId)!;
        l.points.reverse(); 
        removablesThisStep.push(lineId);
      }
    }
    
    if (removablesThisStep.length === 0) {
      if (forceAssignRemaining) {
        for (const id of remainingIds) {
          const l = lines.find(x => x.id === id)!;
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
      const l = lines.find(x => x.id === id)!;
      l.direction = getDir(l.points[l.points.length-1], l.points[l.points.length-2]);
      remainingIds.delete(id);
    }
  }
  
  return { success: true, initialFreeCount };
}
