import * as THREE from "three";
import {
  COLUMN_IDS,
  COLUMN_LABELS,
  LEVELS,
  cellKey,
  type ColumnId,
  type Level,
  type PlayerId,
} from "@domain/board";
import { createLabelTexture } from "./labelTexture";

export const CELL_SIZE = 0.48;
export const CELL_GAP = 0.04;
export const BOARD_GRID = 5 * CELL_SIZE + 4 * CELL_GAP;

/** Subtle empty-cell column identity (Wine → Whisky). */
export const COLUMN_EMPTY_TINT: Record<ColumnId, number> = {
  wine: 0x3a2428,
  rum: 0x3a3224,
  tequila: 0x283328,
  vodka: 0x282e38,
  whisky: 0x332c22,
};

export const COLUMN_BUILT_TINT: Record<ColumnId, number> = {
  wine: 0x8a5a62,
  rum: 0x9a7a48,
  tequila: 0x6a8a68,
  vodka: 0x6a7a98,
  whisky: 0x8a7048,
};

export interface BoardViewHandle {
  readonly ownerId: PlayerId;
  readonly accent: number;
  readonly group: THREE.Group;
  readonly cellMeshes: ReadonlyMap<string, THREE.Mesh>;
  readonly seatRing: THREE.Mesh;
  readonly seatWash: THREE.Mesh;
  figurineRoot: THREE.Group | null;
}

function gridOffset(index: number): number {
  const origin = -BOARD_GRID / 2 + CELL_SIZE / 2;
  return origin + index * (CELL_SIZE + CELL_GAP);
}

/**
 * Local board layout:
 * - X: columns Wine → Whisky (left → right)
 * - Z: Level 1 at local +Z (outer/bottom), Level 5 toward table center.
 */
function levelToLocalZ(level: Level): number {
  return gridOffset(5 - level);
}

export function createPlayerBoard3D(input: {
  ownerId: PlayerId;
  displayName: string;
  accent: number;
}): BoardViewHandle {
  const group = new THREE.Group();
  group.name = `board-${input.ownerId}`;

  // Tray base
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_GRID + 0.42, 0.1, BOARD_GRID + 0.72),
    new THREE.MeshStandardMaterial({
      color: 0x14100e,
      roughness: 0.72,
      metalness: 0.18,
    }),
  );
  tray.position.y = 0.05;
  group.add(tray);

  // Inner felt well
  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_GRID + 0.28, 0.02, BOARD_GRID + 0.48),
    new THREE.MeshStandardMaterial({
      color: 0x1c1412,
      roughness: 0.95,
      metalness: 0.02,
    }),
  );
  felt.position.y = 0.1;
  group.add(felt);

  // Brass edge strip at outer (player) side
  const brassLip = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_GRID + 0.42, 0.035, 0.07),
    new THREE.MeshStandardMaterial({
      color: 0xd4b06a,
      roughness: 0.35,
      metalness: 0.75,
      emissive: 0x3a2a10,
      emissiveIntensity: 0.15,
    }),
  );
  brassLip.position.set(0, 0.12, levelToLocalZ(1) + 0.92);
  group.add(brassLip);

  const cellMeshes = new Map<string, THREE.Mesh>();

  COLUMN_IDS.forEach((column, colIndex) => {
    LEVELS.forEach((level) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(CELL_SIZE * 0.94, 0.07, CELL_SIZE * 0.94),
        new THREE.MeshStandardMaterial({
          color: COLUMN_EMPTY_TINT[column],
          roughness: 0.78,
          metalness: 0.12,
          emissive: 0x000000,
          emissiveIntensity: 0,
        }),
      );
      mesh.position.set(
        gridOffset(colIndex),
        0.14,
        levelToLocalZ(level as Level),
      );
      mesh.userData = {
        kind: "cell",
        ownerId: input.ownerId,
        column,
        level,
        baseY: 0.14,
      };
      group.add(mesh);
      cellMeshes.set(cellKey(column, level as Level), mesh);
    });
  });

  COLUMN_IDS.forEach((column, colIndex) => {
    const label = makeTextPlane(COLUMN_LABELS[column], 0.72, 0.2, {
      fontSize: 40,
      color: "#f0e6d4",
      background: "rgba(12,8,6,0.82)",
    });
    label.position.set(gridOffset(colIndex), 0.18, levelToLocalZ(1) + 0.44);
    label.rotation.x = -Math.PI / 2;
    group.add(label);
  });

  LEVELS.forEach((level) => {
    const label = makeTextPlane(`L${level}`, 0.3, 0.18, {
      fontSize: 34,
      color: "#d4b06a",
      background: "rgba(12,8,6,0.75)",
    });
    label.position.set(
      gridOffset(0) - 0.44,
      0.18,
      levelToLocalZ(level as Level),
    );
    label.rotation.x = -Math.PI / 2;
    group.add(label);
  });

  const title = makeTextPlane(input.displayName, 1.85, 0.28, {
    fontSize: 44,
    color: "#f0e6d4",
    background: "rgba(20,12,10,0.9)",
  });
  title.position.set(0, 0.2, levelToLocalZ(1) + 0.72);
  title.rotation.x = -Math.PI / 2;
  group.add(title);

  const accentBar = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_GRID + 0.2, 0.03, 0.08),
    new THREE.MeshStandardMaterial({
      color: input.accent,
      roughness: 0.4,
      metalness: 0.45,
      emissive: input.accent,
      emissiveIntensity: 0.22,
    }),
  );
  accentBar.position.set(0, 0.14, levelToLocalZ(1) + 0.9);
  group.add(accentBar);

  // Soft under-board wash (toggled for active seat)
  const seatWash = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_GRID + 0.9, BOARD_GRID + 1.15),
    new THREE.MeshBasicMaterial({
      color: input.accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  seatWash.rotation.x = -Math.PI / 2;
  seatWash.position.y = 0.02;
  group.add(seatWash);

  // Active seat brass ring (torus under board)
  const seatRing = new THREE.Mesh(
    new THREE.TorusGeometry(BOARD_GRID * 0.72, 0.035, 10, 48),
    new THREE.MeshStandardMaterial({
      color: 0xd4b06a,
      roughness: 0.3,
      metalness: 0.85,
      emissive: 0xd4b06a,
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0,
    }),
  );
  seatRing.rotation.x = Math.PI / 2;
  seatRing.position.y = 0.03;
  group.add(seatRing);

  return {
    ownerId: input.ownerId,
    accent: input.accent,
    group,
    cellMeshes,
    seatRing,
    seatWash,
    figurineRoot: null,
  };
}

function makeTextPlane(
  text: string,
  width: number,
  height: number,
  style?: {
    fontSize?: number;
    color?: string;
    background?: string;
  },
): THREE.Mesh {
  const canvas = createLabelTexture(text, {
    width: Math.round(width * 256),
    height: Math.round(height * 256),
    fontSize: style?.fontSize ?? 36,
    ...(style?.color ? { color: style.color } : {}),
    ...(style?.background ? { background: style.background } : {}),
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
  radius = 4.35,
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
