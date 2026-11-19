import * as THREE from "three";
import type { ColumnId, Level } from "@domain/board";
import type { MatchState } from "@domain/match";
import {
  createPlayerBoard3D,
  placeBoardsAroundTable,
  type BoardViewHandle,
} from "./boards3d";
import { createFigurineSlots } from "./figurines3d";
import { createWhiteSkull } from "./skull";

const PLAYER_ACCENTS = [0xb0b0b0, 0x8a9bb0, 0xa09080, 0x7a8a7a] as const;

/** Highlight payload — view-only, not authoritative game state. */
export interface SelectionHighlight {
  readonly ownerId: string;
  readonly column: ColumnId;
  readonly level: Level;
}

export type ScenePick =
  | {
      kind: "cell";
      ownerId: string;
      column: string;
      level: number;
    }
  | {
      kind: "figurine-slot";
      ownerId: string;
      slotIndex: number;
      owned: boolean;
    };

export interface TableSceneOptions {
  /** Client M3: normal players focus their own board. */
  readonly focusPlayerId?: string | null;
  readonly ownBoardOnly?: boolean;
}

export interface TableSceneHandle {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly boards: readonly BoardViewHandle[];
  resize: (width: number, height: number) => void;
  render: () => void;
  syncBoardVisuals: (
    match: MatchState,
    selection: SelectionHighlight | null,
    activePlayerId: string,
  ) => void;
  setOwnBoardFocus: (playerId: string | null, ownBoardOnly: boolean) => void;
  pickObject: (clientX: number, clientY: number, dom: HTMLElement) => ScenePick | null;
  dispose: () => void;
}

export function createTableScene(
  container: HTMLElement,
  match: MatchState,
  options: TableSceneOptions = {},
): TableSceneHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 11.5, 10.5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(4, 12, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa0a0ff, 0.25);
  fill.position.set(-6, 4, -4);
  scene.add(fill);

  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.25, 48),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85 }),
  );
  table.position.y = 0;
  scene.add(table);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(14, 48),
    new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.2;
  scene.add(floor);

  const skull = createWhiteSkull();
  skull.position.set(0, 0.12, 0);
  scene.add(skull);

  const boards = match.players.map((player, index) => {
    const accent = PLAYER_ACCENTS[index] ?? 0x888888;
    const board = createPlayerBoard3D({
      ownerId: player.id,
      displayName: player.displayName,
      accent,
    });
    const figurines = createFigurineSlots({
      ownerId: player.id,
      ownedCount: player.ownedFigurines,
      maxCount: match.rules.maxFigurines,
      accent,
    });
    board.group.add(figurines);
    scene.add(board.group);
    return board;
  });

  placeBoardsAroundTable(boards);

  function applyOwnBoardFocus(
    playerId: string | null,
    ownBoardOnly: boolean,
  ): void {
    for (const board of boards) {
      const isMine = playerId != null && board.ownerId === playerId;
      board.group.visible = !ownBoardOnly || isMine || playerId == null;
    }
    if (playerId && ownBoardOnly) {
      const mine = boards.find((b) => b.ownerId === playerId);
      if (mine) {
        const p = mine.group.position;
        camera.position.set(p.x * 0.35, 8.5, p.z * 0.35 + (p.z >= 0 ? 6.5 : -6.5));
        camera.lookAt(p.x, 0.2, p.z);
      }
    } else {
      camera.position.set(0, 11.5, 10.5);
      camera.lookAt(0, 0, 0);
    }
  }

  applyOwnBoardFocus(options.focusPlayerId ?? null, options.ownBoardOnly === true);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const defaultCellColor = 0x2a2a2a;
  const activeBoardTint = 0x3a4550;
  const builtColor = 0x8a8a8a;
  const builtActiveColor = 0x9aa8b8;
  const selectedColor = 0xc8c8c8;

  function syncBoardVisuals(
    nextMatch: MatchState,
    selection: SelectionHighlight | null,
    activePlayerId: string,
  ): void {
    for (const board of boards) {
      const player = nextMatch.players.find((p) => p.id === board.ownerId);
      for (const [key, mesh] of board.cellMeshes) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        const occupancy = player?.board.cells[key];
        const isBuilt = occupancy?.kind === "built";
        const isActiveBoard = board.ownerId === activePlayerId;
        const isSelected =
          selection !== null &&
          selection.ownerId === board.ownerId &&
          selection.column === mesh.userData.column &&
          selection.level === mesh.userData.level;

        if (isSelected) {
          material.color.setHex(selectedColor);
        } else if (isBuilt) {
          material.color.setHex(isActiveBoard ? builtActiveColor : builtColor);
        } else if (isActiveBoard) {
          material.color.setHex(activeBoardTint);
        } else {
          material.color.setHex(defaultCellColor);
        }

        mesh.position.y = isBuilt ? 0.16 : 0.11;
        mesh.scale.y = isBuilt ? 1.8 : 1;
      }
    }
  }

  function pickObject(
    clientX: number,
    clientY: number,
    dom: HTMLElement,
  ): ScenePick | null {
    const rect = dom.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        const data = obj.userData as Record<string, unknown>;
        if (data.kind === "cell") {
          return {
            kind: "cell",
            ownerId: String(data.ownerId),
            column: String(data.column),
            level: Number(data.level),
          };
        }
        if (data.kind === "figurine-slot") {
          return {
            kind: "figurine-slot",
            ownerId: String(data.ownerId),
            slotIndex: Number(data.slotIndex),
            owned: Boolean(data.owned),
          };
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  syncBoardVisuals(match, null, match.players[0]?.id ?? "");

  return {
    scene,
    camera,
    renderer,
    boards,
    resize(nextWidth: number, nextHeight: number) {
      camera.aspect = nextWidth / Math.max(nextHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, Math.max(nextHeight, 1));
    },
    render() {
      renderer.render(scene, camera);
    },
    syncBoardVisuals,
    setOwnBoardFocus: applyOwnBoardFocus,
    pickObject,
    dispose() {
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const material of materials) {
            if (material instanceof THREE.Material) {
              const map = (material as THREE.MeshBasicMaterial).map;
              map?.dispose();
              material.dispose();
            }
          }
        }
      });
      renderer.domElement.remove();
    },
  };
}
