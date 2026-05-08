export type Point = { x: number; y: number };

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface LineSegment {
  id: string;
  points: Point[]; // Set of points the line occupies
  direction: Direction;
  isExiting?: boolean;
  isFlying?: boolean;
  exitTarget?: Point; // Where it flies to
  color?: string; // Random color assigned per line
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
    eraserInstructions: boolean;
    guideLines: boolean;
  };
  items: {
    hint: number;
    eraser: number;
    guide: number;
  };
  guideActiveInLevel: boolean;
  clearedPoints: Point[];
  currentMask: Point[];
  tutorialClicked: boolean;
}

export type ShapeType = 'heart' | 'square' | 'circle' | 'diamond' | 'random';
