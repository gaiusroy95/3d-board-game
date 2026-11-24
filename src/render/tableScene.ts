import * as THREE from "three";
import type { ColumnId, Level } from "@domain/board";
import type { MatchState } from "@domain/match";
import {
  COLUMN_BUILT_TINT,
  COLUMN_EMPTY_TINT,
  createPlayerBoard3D,
  placeBoardsAroundTable,
  type BoardViewHandle,
} from "./boards3d";
import {
  createFigurineSlots,
  syncFigurineOwnership,
  tickFigurineIdle,
} from "./figurines3d";
import { createWhiteSkull } from "./skull";

/** Seat accents aligned with CSS --seat-1..4 */
const PLAYER_ACCENTS = [0xc45c6a, 0xc48a3a, 0x6a9e6e, 0x5b7fb5] as const;

const BRASS = 0xd4b06a;
const SELECTED = 0xe8d4a0;

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

function createLayeredTable(): THREE.Group {
  const group = new THREE.Group();
  group.name = "speakeasy-table";

  const woodDark = new THREE.MeshStandardMaterial({
    color: 0x1a120e,
    roughness: 0.65,
    metalness: 0.15,
  });
  const woodMid = new THREE.MeshStandardMaterial({
    color: 0x2a1c14,
    roughness: 0.55,
    metalness: 0.2,
  });
  const felt = new THREE.MeshStandardMaterial({
    color: 0x14100f,
    roughness: 0.92,
    metalness: 0.05,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: BRASS,
    roughness: 0.32,
    metalness: 0.82,
    emissive: 0x2a1e08,
    emissiveIntensity: 0.25,
  });

  const apron = new THREE.Mesh(
    new THREE.CylinderGeometry(3.35, 3.45, 0.38, 64),
    woodDark,
  );
  apron.position.y = -0.05;
  group.add(apron);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(3.22, 3.22, 0.12, 64),
    woodMid,
  );
  top.position.y = 0.14;
  group.add(top);

  const feltDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(2.95, 2.95, 0.04, 64),
    felt,
  );
  feltDisk.position.y = 0.21;
  group.add(feltDisk);

  const brassRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.05, 0.045, 12, 72),
    brass,
  );
  brassRing.rotation.x = Math.PI / 2;
  brassRing.position.y = 0.22;
  brassRing.userData.shimmer = true;
  group.add(brassRing);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.028, 10, 48),
    brass.clone(),
  );
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.23;
  group.add(innerRing);

  return group;
}

export function createTableScene(
  container: HTMLElement,
  match: MatchState,
  options: TableSceneOptions = {},
): TableSceneHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070504);
  scene.fog = new THREE.FogExp2(0x070504, 0.028);

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 80);
  const camPos = new THREE.Vector3(0, 11.2, 10.2);
  const camLook = new THREE.Vector3(0, 0.15, 0);
  const camPosTarget = camPos.clone();
  const camLookTarget = camLook.clone();
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  // Lighting: warm brass key + cool wine fill (no purple)
  const ambient = new THREE.AmbientLight(0xffe8d0, 0.28);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffd7a8, 1.15);
  key.position.set(5, 14, 7);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8a4050, 0.35);
  fill.position.set(-7, 5, -5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xd4b06a, 0.22);
  rim.position.set(0, 3, -8);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshStandardMaterial({
      color: 0x050302,
      roughness: 1,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.35;
  scene.add(floor);

  const vignette = new THREE.Mesh(
    new THREE.RingGeometry(6.5, 16, 64),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  vignette.rotation.x = -Math.PI / 2;
  vignette.position.y = -0.34;
  scene.add(vignette);

  const table = createLayeredTable();
  scene.add(table);

  const skull = createWhiteSkull();
  skull.position.set(0, 0.22, 0);
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
    board.figurineRoot = figurines;
    board.group.add(figurines);
    scene.add(board.group);
    return board;
  });

  placeBoardsAroundTable(boards);

  let focusPlayerId: string | null = options.focusPlayerId ?? null;
  let ownBoardOnly = options.ownBoardOnly === true;
  let lastActivePlayerId = match.players[0]?.id ?? "";

  function computeCameraTargets(
    playerId: string | null,
    ownOnly: boolean,
    activeId: string,
  ): { pos: THREE.Vector3; look: THREE.Vector3 } {
    if (playerId && ownOnly) {
      const mine = boards.find((b) => b.ownerId === playerId);
      if (mine) {
        const p = mine.group.position;
        return {
          pos: new THREE.Vector3(
            p.x * 0.38,
            8.2,
            p.z * 0.38 + (p.z >= 0 ? 6.2 : -6.2),
          ),
          look: new THREE.Vector3(p.x, 0.25, p.z),
        };
      }
    }
    // Hotseat: ease slightly toward active seat
    if (!ownOnly && activeId) {
      const active = boards.find((b) => b.ownerId === activeId);
      if (active) {
        const p = active.group.position;
        return {
          pos: new THREE.Vector3(
            p.x * 0.18,
            11.0,
            10.0 + p.z * 0.12,
          ),
          look: new THREE.Vector3(p.x * 0.25, 0.2, p.z * 0.25),
        };
      }
    }
    return {
      pos: new THREE.Vector3(0, 11.2, 10.2),
      look: new THREE.Vector3(0, 0.15, 0),
    };
  }

  function applyOwnBoardFocus(
    playerId: string | null,
    ownOnly: boolean,
  ): void {
    focusPlayerId = playerId;
    ownBoardOnly = ownOnly;
    for (const board of boards) {
      const isMine = playerId != null && board.ownerId === playerId;
      board.group.visible = !ownOnly || isMine || playerId == null;
    }
    const targets = computeCameraTargets(playerId, ownOnly, lastActivePlayerId);
    camPosTarget.copy(targets.pos);
    camLookTarget.copy(targets.look);
  }

  applyOwnBoardFocus(options.focusPlayerId ?? null, options.ownBoardOnly === true);
  // Snap initial camera
  camera.position.copy(camPosTarget);
  camPos.copy(camPosTarget);
  camLook.copy(camLookTarget);
  camera.lookAt(camLook);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  let prevElapsed = 0;

  function syncBoardVisuals(
    nextMatch: MatchState,
    selection: SelectionHighlight | null,
    activePlayerId: string,
  ): void {
    if (activePlayerId !== lastActivePlayerId) {
      lastActivePlayerId = activePlayerId;
      const targets = computeCameraTargets(
        focusPlayerId,
        ownBoardOnly,
        activePlayerId,
      );
      camPosTarget.copy(targets.pos);
      camLookTarget.copy(targets.look);
    }

    for (const board of boards) {
      const player = nextMatch.players.find((p) => p.id === board.ownerId);
      const isActiveBoard = board.ownerId === activePlayerId;

      const wash = board.seatWash.material as THREE.MeshBasicMaterial;
      wash.opacity = isActiveBoard ? 0.14 : 0.0;

      const ring = board.seatRing.material as THREE.MeshStandardMaterial;
      ring.opacity = isActiveBoard ? 0.85 : 0.0;
      ring.emissiveIntensity = isActiveBoard ? 0.45 : 0;

      if (board.figurineRoot && player) {
        syncFigurineOwnership(
          board.figurineRoot,
          player.ownedFigurines,
          board.accent,
        );
      }

      for (const [key, mesh] of board.cellMeshes) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        const column = mesh.userData.column as ColumnId;
        const occupancy = player?.board.cells[key];
        const isBuilt = occupancy?.kind === "built";
        const isSelected =
          selection !== null &&
          selection.ownerId === board.ownerId &&
          selection.column === mesh.userData.column &&
          selection.level === mesh.userData.level;

        const baseY = Number(mesh.userData.baseY) || 0.14;

        if (isSelected) {
          material.color.setHex(SELECTED);
          material.emissive.setHex(BRASS);
          material.emissiveIntensity = 0.55;
          material.metalness = 0.55;
          material.roughness = 0.3;
          mesh.position.y = baseY + 0.08;
          mesh.scale.set(1.05, 2.4, 1.05);
        } else if (isBuilt) {
          material.color.setHex(COLUMN_BUILT_TINT[column]);
          if (isActiveBoard) material.color.offsetHSL(0, 0.05, 0.05);
          material.emissive.setHex(isActiveBoard ? board.accent : 0x000000);
          material.emissiveIntensity = isActiveBoard ? 0.12 : 0;
          material.metalness = 0.35;
          material.roughness = 0.45;
          mesh.position.y = baseY + 0.05;
          mesh.scale.set(1, 2.2, 1);
        } else {
          material.color.setHex(COLUMN_EMPTY_TINT[column]);
          if (isActiveBoard) {
            material.color.offsetHSL(0, 0.04, 0.06);
          }
          material.emissive.setHex(0x000000);
          material.emissiveIntensity = 0;
          material.metalness = 0.12;
          material.roughness = 0.78;
          mesh.position.y = baseY;
          mesh.scale.set(1, 1, 1);
        }
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
      const t = clock.getElapsedTime();
      const dt = Math.min(Math.max(t - prevElapsed, 0), 0.05);
      prevElapsed = t;

      // Camera ease toward focus / active seat
      const ease = 1 - Math.exp(-dt * 3.2);
      camPos.lerp(camPosTarget, ease);
      camLook.lerp(camLookTarget, ease);
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      // Skull idle
      skull.rotation.y = Math.sin(t * 0.35) * 0.12;
      skull.position.y = 0.22 + Math.sin(t * 1.1) * 0.02;

      // Brass ring shimmer
      table.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh &&
          obj.userData.shimmer &&
          obj.material instanceof THREE.MeshStandardMaterial
        ) {
          obj.material.emissiveIntensity = 0.2 + Math.sin(t * 1.8) * 0.08;
        }
      });

      for (const board of boards) {
        if (board.figurineRoot) tickFigurineIdle(board.figurineRoot, t);
      }

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
          const materials = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
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
