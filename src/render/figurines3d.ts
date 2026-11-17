import * as THREE from "three";
import type { PlayerId } from "@domain/board";
import { BOARD_GRID } from "./boards3d";

/**
 * Visual figurine slots only.
 * Client: figurines are activated (popup), not moved. Owned count starts at 0
 * until unlock conditions exist — empty/dim slots show capacity (7).
 */
export function createFigurineSlots(input: {
  ownerId: PlayerId;
  ownedCount: number;
  maxCount?: number;
  accent: number;
}): THREE.Group {
  const maxCount = input.maxCount ?? 7;
  const group = new THREE.Group();
  group.name = `figurines-${input.ownerId}`;

  for (let i = 0; i < maxCount; i += 1) {
    const owned = i < input.ownedCount;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.28, 10),
      new THREE.MeshStandardMaterial({
        color: owned ? input.accent : 0x3a3a3a,
        roughness: 0.7,
        metalness: owned ? 0.15 : 0.05,
        transparent: !owned,
        opacity: owned ? 1 : 0.45,
      }),
    );
    body.position.set(
      -BOARD_GRID / 2 - 0.35,
      0.22,
      -BOARD_GRID / 2 + 0.2 + i * 0.32,
    );
    body.userData = {
      kind: "figurine-slot",
      ownerId: input.ownerId,
      slotIndex: i,
      owned,
      // Client: activate via popup later — not a draggable piece.
      activatable: owned,
    };
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 10),
      new THREE.MeshStandardMaterial({
        color: owned ? 0xeeeeee : 0x555555,
        roughness: 0.6,
      }),
    );
    head.position.copy(body.position);
    head.position.y += 0.2;
    head.userData = body.userData;
    group.add(head);
  }

  return group;
}
