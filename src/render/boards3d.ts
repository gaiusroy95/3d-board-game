import * as THREE from "three";
import {
  COLUMN_IDS,
  COLUMN_LABELS,
  LEVELS,
  cellKey,
  type Level,
  type PlayerId,
} from "@domain/board";
import { createLabelTexture } from "./labelTexture";

export const CELL_SIZE = 0.48;
export const CELL_GAP = 0.04;
export const BOARD_GRID = 5 * CELL_SIZE + 4 * CELL_GAP;

export interface BoardViewHandle {
  readonly ownerId: PlayerId;
  readonly group: THREE.Group;
  readonly cellMeshes: ReadonlyMap<string, THREE.Mesh>;
}

function gridOffset(index: number): number {
  const origin = -BOARD_GRID / 2 + CELL_SIZE / 2;
  return origin + index * (CELL_SIZE + CELL_GAP);
}

/**
 * Local board layout:
 * - X: columns Wine → Whisky (left → right)
 * - Z: Level 1 at local +Z (outer/bottom edge toward seated player),
 *   Level 5 at local -Z (toward table center / top of board).
 *   Matches client: Level 1 on bottom.
 */
function levelToLocalZ(level: Level): number {
  // level 1 → highest +Z index (4); level 5 → index 0
  return gridOffset(5 - level);
}

export function createPlayerBoard3D(input: {
  ownerId: PlayerId;
  displayName: string;
  accent: number;
}): BoardViewHandle {
  const group = new THREE.Group();
  group.name = `board-${input.ownerId}`;

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_GRID + 0.35, 0.08, BOARD_GRID + 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }),
  );
  panel.position.y = 0.04;
  group.add(panel);

  const cellMeshes = new Map<string, THREE.Mesh>();

  COLUMN_IDS.forEach((column, colIndex) => {
    LEVELS.forEach((level) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(CELL_SIZE, 0.06, CELL_SIZE),
        new THREE.MeshStandardMaterial({
          color: 0x2a2a2a,
          roughness: 0.85,
          metalness: 0.05,
        }),
      );
      mesh.position.set(gridOffset(colIndex), 0.11, levelToLocalZ(level as Level));
      mesh.userData = {
        kind: "cell",
        ownerId: input.ownerId,
        column,
        level,
      };
      group.add(mesh);
      cellMeshes.set(cellKey(column, level as Level), mesh);
    });
  });

  COLUMN_IDS.forEach((column, colIndex) => {
    const label = makeTextPlane(COLUMN_LABELS[column], 0.7, 0.18);
    label.position.set(gridOffset(colIndex), 0.14, levelToLocalZ(1) + 0.42);
    label.rotation.x = -Math.PI / 2;
    group.add(label);
  });

  LEVELS.forEach((level) => {
    const label = makeTextPlane(`L${level}`, 0.28, 0.18);
    label.position.set(gridOffset(0) - 0.42, 0.14, levelToLocalZ(level as Level));
    label.rotation.x = -Math.PI / 2;
    group.add(label);
  });

  const title = makeTextPlane(input.displayName, 1.6, 0.22);
  title.position.set(0, 0.14, levelToLocalZ(1) + 0.7);
  title.rotation.x = -Math.PI / 2;
  group.add(title);

  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_GRID + 0.35, 0.02, 0.06),
    new THREE.MeshStandardMaterial({ color: input.accent, roughness: 0.5 }),
  );
  accent.position.set(0, 0.1, levelToLocalZ(1) + 0.86);
  group.add(accent);

  return { ownerId: input.ownerId, group, cellMeshes };
}

function makeTextPlane(text: string, width: number, height: number): THREE.Mesh {
  const canvas = createLabelTexture(text, {
    width: Math.round(width * 256),
    height: Math.round(height * 256),
    fontSize: 36,
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

/** Place four boards around the table (shared fixed layout). */
export function placeBoardsAroundTable(
  boards: readonly BoardViewHandle[],
  radius = 4.2,
): void {
  if (boards.length !== 4) {
    throw new Error("Expected four boards");
  }
  const layouts: { x: number; z: number; rotY: number }[] = [
    { x: 0, z: radius, rotY: 0 },
    { x: radius, z: 0, rotY: -Math.PI / 2 },
    { x: 0, z: -radius, rotY: Math.PI },
    { x: -radius, z: 0, rotY: Math.PI / 2 },
  ];
  boards.forEach((board, i) => {
    const layout = layouts[i];
    if (!layout) return;
    board.group.position.set(layout.x, 0.02, layout.z);
    board.group.rotation.y = layout.rotY;
  });
}
