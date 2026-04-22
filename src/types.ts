export type Point = { x: number; y: number };

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface LineSegment {
  id: string;
  points: Point[]; // Set of points the line occupies
  direction: Direction;
  isExiting?: boolean;
  exitTarget?: Point; // Where it flies to
}

export interface GameState {
  gridSize: number;
  lines: LineSegment[];
  hearts: number;
  level: number;
  gameOver: boolean;
  victory: boolean;
  showVictorySummary: boolean;
  activeItems: {
    hint?: string; // id of the hinted line
    removeMode: boolean;
    guideLines: boolean;
  };
  clearedPoints: Point[];
  currentMask: Point[];
}

export type ShapeType = 'heart' | 'square' | 'circle' | 'diamond' | 'random';
