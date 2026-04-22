import { Point, Direction, LineSegment } from '../types';

export function getDirectionVector(dir: Direction): Point {
  switch (dir) {
    case 'up': return { x: 0, y: -1 };
    case 'down': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
  }
}

export function pointsEqual(p1: Point, p2: Point): boolean {
  return p1.x === p2.x && p1.y === p2.y;
}

export function isPointInList(p: Point, list: Point[]): boolean {
  return list.some(item => pointsEqual(item, p));
}

export function getOccupiedPoints(lines: LineSegment[]): Point[] {
  return lines.flatMap(l => l.points);
}

export function isBlocked(line: LineSegment, allLines: LineSegment[], gridSize: number): boolean {
  return getBlockingDistance(line, allLines, gridSize) !== -1;
}

export function getBlockingDistance(line: LineSegment, allLines: LineSegment[], gridSize: number): number {
  const head = line.points[line.points.length - 1]; // Last point is the arrow head
  const dirVec = getDirectionVector(line.direction);
  // Ignore lines that are already exiting to allow continuous clear
  const otherPoints = allLines
    .filter(l => l.id !== line.id && !l.isExiting)
    .flatMap(l => l.points);

  // Check own body except head
  const selfBody = line.points.slice(0, -1);

  let current = { x: head.x + dirVec.x, y: head.y + dirVec.y };
  let distance = 1;

  while (current.x >= 0 && current.x < gridSize && current.y >= 0 && current.y < gridSize) {
    if (isPointInList(current, otherPoints)) return distance;
    if (isPointInList(current, selfBody)) return distance;
    current = { x: current.x + dirVec.x, y: current.y + dirVec.y };
    distance++;
  }

  // -1 means it's not blocked natively (can escape)
  return -1;
}
