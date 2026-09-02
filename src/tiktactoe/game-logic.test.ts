import { describe, expect, it } from 'vitest';

/**
 * Self-contained tests for the plain-JS Tic-Tac-Toe game in
 * `tiktactoe-app/index.html`. The game has no build step or module system,
 * so these tests mirror the shipped pure logic (win detection and undo
 * semantics) so the behaviour stays pinned down under `npm test`.
 */

type Player = 'X' | 'O';

interface Move {
  index: number;
  player: Player;
}

interface GameState {
  cells: (Player | null)[];
  current: Player;
  mode: 'pvp' | 'ai';
  finished: boolean;
  history: Move[];
}

const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function findWinner(cells: (Player | null)[]): { winner: Player; line: readonly number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const first = cells[a];
    if (first && first === cells[b] && first === cells[c]) {
      return { winner: first, line };
    }
  }
  return null;
}

function isBoardFull(cells: (Player | null)[]): boolean {
  return cells.every((cell) => cell !== null);
}

function freshState(mode: 'pvp' | 'ai'): GameState {
  return {
    cells: new Array<Player | null>(9).fill(null),
    current: 'X',
    mode,
    finished: false,
    history: [],
  };
}

function place(state: GameState, index: number, player: Player): void {
  state.cells[index] = player;
  state.history.push({ index, player });
  const result = findWinner(state.cells);
  if (result) {
    state.finished = true;
    return;
  }
  if (isBoardFull(state.cells)) {
    state.finished = true;
    return;
  }
  state.current = player === 'X' ? 'O' : 'X';
}

function applyUndo(state: GameState): GameState {
  if (state.finished || state.history.length === 0) {
    return { ...state, cells: [...state.cells] };
  }

  const history = [...state.history];
  if (state.mode === 'ai') {
    const last = history[history.length - 1];
    if (last && last.player === 'O') {
      history.pop();
      if (history.length > 0) {
        history.pop();
      }
    } else {
      history.pop();
    }
    state.current = 'X';
  } else {
    const removed = history.pop();
    if (removed) {
      state.current = removed.player;
    }
  }

  const cells = new Array<Player | null>(9).fill(null);
  for (const move of history) {
    cells[move.index] = move.player;
  }

  return { ...state, cells, history };
}

describe('tiktactoe win detection', () => {
  it('detects the three rows', () => {
    for (const player of ['X', 'O'] as const) {
      for (const row of [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ] as const) {
        const cells = new Array<Player | null>(9).fill(null);
        for (const idx of row) {
          cells[idx] = player;
        }
        expect(findWinner(cells)?.winner).toBe(player);
      }
    }
  });

  it('detects the three columns', () => {
    for (const player of ['X', 'O'] as const) {
      for (const col of [
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
      ] as const) {
        const cells = new Array<Player | null>(9).fill(null);
        for (const idx of col) {
          cells[idx] = player;
        }
        expect(findWinner(cells)?.winner).toBe(player);
      }
    }
  });

  it('detects both diagonals', () => {
    const cells = new Array<Player | null>(9).fill(null);
    cells[0] = 'X';
    cells[4] = 'X';
    cells[8] = 'X';
    expect(findWinner(cells)?.line).toEqual([0, 4, 8]);

    const other = new Array<Player | null>(9).fill(null);
    other[2] = 'X';
    other[4] = 'X';
    other[6] = 'X';
    expect(findWinner(other)?.line).toEqual([2, 4, 6]);
  });

  it('returns null when there is no winning line', () => {
    const state = freshState('pvp');
    place(state, 0, 'X');
    place(state, 1, 'O');
    place(state, 2, 'X');
    expect(findWinner(state.cells)).toBeNull();
  });

  it('flags a full board with no winner as full', () => {
    const cells: (Player | null)[] = ['X', 'O', 'X', 'O', 'X', 'X', 'O', 'X', 'O'];
    expect(findWinner(cells)).toBeNull();
    expect(isBoardFull(cells)).toBe(true);
  });
});

describe('tiktactoe undo semantics', () => {
  it('pvp: a single undo reverts the last move and hands the turn back', () => {
    const state = freshState('pvp');
    place(state, 0, 'X');
    place(state, 3, 'O');

    const after = applyUndo(state);
    expect(after.history.map((m) => m.index)).toEqual([0]);
    expect(after.cells[3]).toBeNull();
    expect(after.cells[0]).toBe('X');
    expect(after.current).toBe('O');
  });

  it('pvp: repeated undos eventually empty the board and return to X', () => {
    const state = freshState('pvp');
    place(state, 0, 'X');
    place(state, 1, 'O');
    let after = applyUndo(state);
    after = applyUndo(after);
    expect(after.history).toEqual([]);
    expect(after.cells).toEqual(new Array<Player | null>(9).fill(null));
    expect(after.current).toBe('X');
  });

  it('ai: undoing during a pending AI turn cancels only the human move', () => {
    const state = freshState('ai');
    place(state, 0, 'X');

    const after = applyUndo(state);
    expect(after.history).toEqual([]);
    expect(after.cells[0]).toBeNull();
    expect(after.current).toBe('X');
  });

  it('ai: undoing after the AI responded removes both moves and returns to X', () => {
    const state = freshState('ai');
    place(state, 0, 'X');
    place(state, 4, 'O');

    const after = applyUndo(state);
    expect(after.history).toEqual([]);
    expect(after.cells[0]).toBeNull();
    expect(after.cells[4]).toBeNull();
    expect(after.current).toBe('X');
  });

  it('undo is a no-op on a finished board', () => {
    const state = freshState('pvp');
    place(state, 0, 'X');
    place(state, 3, 'O');
    place(state, 1, 'X');
    place(state, 4, 'O');
    place(state, 2, 'X');
    expect(state.finished).toBe(true);

    const after = applyUndo(state);
    expect(after.history).toEqual(state.history);
    expect(after.cells).toEqual(state.cells);
  });

  it('undo keeps the board structurally valid after mixed players', () => {
    const state = freshState('pvp');
    place(state, 0, 'X');
    place(state, 1, 'O');
    place(state, 2, 'X');
    place(state, 3, 'O');

    const after = applyUndo(state);
    expect(after.history.map((m) => m.index)).toEqual([0, 1, 2]);
    expect(after.cells[3]).toBeNull();
    expect(after.current).toBe('O');
  });
});
