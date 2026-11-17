import type { BoardPosition, ColumnId, Level, PlayerId } from "@domain/board";

/** View/UI selection — separate from authoritative MatchState. */
export interface CellSelection {
  readonly ownerId: PlayerId;
  readonly position: BoardPosition;
}

export interface FigurinePopupState {
  readonly ownerId: PlayerId;
  readonly slotIndex: number;
}

export interface MatchUiState {
  readonly selectedCell: CellSelection | null;
  readonly figurinePopup: FigurinePopupState | null;
  readonly statusMessage: string | null;
}

export const initialMatchUiState: MatchUiState = {
  selectedCell: null,
  figurinePopup: null,
  statusMessage: null,
};

export function describeCell(selection: CellSelection): string {
  const col = selection.position.column;
  const level = selection.position.level;
  return `${selection.ownerId} · ${col} L${level}`;
}

export type PickPayload =
  | {
      kind: "cell";
      ownerId: PlayerId;
      column: ColumnId;
      level: Level;
    }
  | {
      kind: "figurine-slot";
      ownerId: PlayerId;
      slotIndex: number;
      owned: boolean;
    };
