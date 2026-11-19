import { useEffect, useRef } from "react";
import type { MatchState } from "@domain/match";
import { getActivePlayerId } from "@domain/match";
import { createTableScene, type TableSceneHandle } from "@render/tableScene";
import type { CellSelection, PickPayload } from "./matchUi";
import type { ColumnId, Level } from "@domain/board";
import { COLUMN_IDS } from "@domain/board";

interface GameViewportProps {
  match: MatchState;
  selection: CellSelection | null;
  onPick: (pick: PickPayload) => void;
  /** M3: focus / hide other boards for the local player. */
  focusPlayerId?: string | null;
  ownBoardOnly?: boolean;
}

function isColumnId(value: string): value is ColumnId {
  return (COLUMN_IDS as readonly string[]).includes(value);
}

function isLevel(value: number): value is Level {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/**
 * Mounts Three.js once; syncs highlights from UI selection + active player.
 * Picks emit intents — domain/UI owners decide legality.
 */
export function GameViewport({
  match,
  selection,
  onPick,
  focusPlayerId = null,
  ownBoardOnly = false,
}: GameViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<TableSceneHandle | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let disposed = false;
    let frame = 0;
    const handle = createTableScene(host, match, {
      focusPlayerId,
      ownBoardOnly,
    });
    sceneRef.current = handle;

    const onResize = () => {
      if (!hostRef.current) return;
      handle.resize(hostRef.current.clientWidth, hostRef.current.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const onClick = (event: MouseEvent) => {
      const pick = handle.pickObject(event.clientX, event.clientY, handle.renderer.domElement);
      if (!pick) return;
      if (pick.kind === "cell") {
        if (!isColumnId(pick.column) || !isLevel(pick.level)) return;
        onPickRef.current({
          kind: "cell",
          ownerId: pick.ownerId,
          column: pick.column,
          level: pick.level,
        });
        return;
      }
      onPickRef.current({
        kind: "figurine-slot",
        ownerId: pick.ownerId,
        slotIndex: pick.slotIndex,
        owned: pick.owned,
      });
    };
    handle.renderer.domElement.addEventListener("click", onClick);

    const tick = () => {
      if (disposed) return;
      handle.render();
      frame = window.requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      handle.renderer.domElement.removeEventListener("click", onClick);
      handle.dispose();
      sceneRef.current = null;
    };
    // Scene is created once for the match id; board layout does not rebuild each turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable mount
  }, [match.id]);

  useEffect(() => {
    const handle = sceneRef.current;
    if (!handle) return;
    handle.setOwnBoardFocus(focusPlayerId ?? null, ownBoardOnly);
  }, [focusPlayerId, ownBoardOnly]);

  useEffect(() => {
    const handle = sceneRef.current;
    if (!handle) return;
    handle.syncBoardVisuals(
      match,
      selection
        ? {
            ownerId: selection.ownerId,
            column: selection.position.column,
            level: selection.position.level,
          }
        : null,
      getActivePlayerId(match),
    );
  }, [match, selection]);

  return <div className="game-viewport" ref={hostRef} aria-label="3D game table" />;
}
