/**
 * Shape patterns defined as strings for easy editing.
 * Each character is a cell in a 10x10 or 30x30 grid.
 */

export const SHAPE_PATTERNS: Record<string, string[]> = {
  tutorial: [
    "  X   X   X  ",
    "  X   X   X  ",
    "  X   X   X  ",
    "  X   X   X  ",
    "  X   X   X  ",
    "  X   X   X  ",
    "  X   X   X  ",
    "  X   X   X  ",
    "  X   X   X  ",
  ],
  heart_small: [
    "  XX   XX  ",
    " XXXXX XXXX ",
    "XXXXXXXXXXX",
    "XXXXXXXXXXX",
    " XXXXXXXXX ",
    "  XXXXXXX  ",
    "   XXXXX   ",
    "    XXX    ",
    "     X     ",
  ],
  square_spiral: [
    "XXXXXXXXXXXXX",
    "X           X",
    "X XXXXXXXXX X",
    "X X       X X",
    "X X XXXXX X X",
    "X X X   X X X",
    "X X X X X X X",
    "X X XXXXX X X",
    "X X       X X",
    "X XXXXXXXXX X",
    "X           X",
    "XXXXXXXXXXXXX",
  ],
  star: [
    "    X    ",
    "   XXX   ",
    "  XXXXX  ",
    "XXXXXXXXX",
    " XXXXXXX ",
    "  XXXXX  ",
    " XXXXXXX ",
    "XX     XX",
  ],
  big_heart: [
    "     XXXX        XXXX     ",
    "   XXXXXXXX    XXXXXXXX   ",
    "  XXXXXXXXXX  XXXXXXXXXX  ",
    " XXXXXXXXXXXX XXXXXXXXXXXX ",
    "XXXXXXXXXXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXXXXXXXXXX",
    " XXXXXXXXXXXXXXXXXXXXXXXX ",
    " XXXXXXXXXXXXXXXXXXXXXXXX ",
    "  XXXXXXXXXXXXXXXXXXXXXX  ",
    "   XXXXXXXXXXXXXXXXXXXX   ",
    "    XXXXXXXXXXXXXXXXXX    ",
    "     XXXXXXXXXXXXXXXX     ",
    "      XXXXXXXXXXXXXX      ",
    "       XXXXXXXXXXXX       ",
    "         XXXXXXXX         ",
    "          XXXXXX          ",
    "            XX            ",
  ],
  cross: [
    "          XXXXXX          ",
    "          XXXXXX          ",
    "          XXXXXX          ",
    "          XXXXXX          ",
    "          XXXXXX          ",
    "  XXXXXXXXXXXXXXXXXXXXXX  ",
    "  XXXXXXXXXXXXXXXXXXXXXX  ",
    "  XXXXXXXXXXXXXXXXXXXXXX  ",
    "          XXXXXX          ",
    "          XXXXXX          ",
    "          XXXXXX          ",
    "          XXXXXX          ",
    "          XXXXXX          ",
  ],
};

export function parsePattern(pattern: string[]): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const height = pattern.length;
  const width = pattern[0].length;
  
  // Center it in a 30x30 grid
  const offsetX = Math.floor((30 - width) / 2);
  const offsetY = Math.floor((30 - height) / 2);

  pattern.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char !== ' ') {
        points.push({ x: x + offsetX, y: y + offsetY });
      }
    });
  });
  
  return points;
}
