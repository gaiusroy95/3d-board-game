import * as THREE from "three";
import type { PlayerId } from "@domain/board";
import { BOARD_GRID } from "./boards3d";

const sharedBodyGeo = new THREE.CylinderGeometry(0.07, 0.11, 0.22, 12);
const sharedHeadGeo = new THREE.SphereGeometry(0.075, 12, 12);
const sharedShoulderGeo = new THREE.BoxGeometry(0.16, 0.05, 0.08);
const sharedPedestalGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.04, 10);

/**
 * Visual figurine slots — street-legend idols.
 * Locked = dim silhouette; owned = accent metal + idle bob via userData.
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
  group.userData.kind = "figurine-root";

  for (let i = 0; i < maxCount; i += 1) {
    const owned = i < input.ownedCount;
    const slot = new THREE.Group();
    slot.name = `fig-slot-${i}`;

    const baseY = 0.2;
    const z = -BOARD_GRID / 2 + 0.15 + i * 0.34;
    const x = -BOARD_GRID / 2 - 0.42;

    const pedestal = new THREE.Mesh(
      sharedPedestalGeo,
      new THREE.MeshStandardMaterial({
        color: owned ? 0x3a2e20 : 0x1a1a1a,
        metalness: owned ? 0.55 : 0.1,
        roughness: owned ? 0.4 : 0.9,
      }),
    );
    pedestal.position.set(0, 0.02, 0);
    pedestal.userData.figPart = "pedestal";
    slot.add(pedestal);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: owned ? input.accent : 0x2e2a28,
      roughness: owned ? 0.38 : 0.85,
      metalness: owned ? 0.55 : 0.08,
      transparent: !owned,
      opacity: owned ? 1 : 0.38,
      emissive: owned ? input.accent : 0x000000,
      emissiveIntensity: owned ? 0.18 : 0,
    });

    const body = new THREE.Mesh(sharedBodyGeo, bodyMat);
    body.position.set(0, 0.16, 0);
    body.userData.figPart = "body";
    slot.add(body);

    const shoulders = new THREE.Mesh(sharedShoulderGeo, bodyMat.clone());
    shoulders.position.set(0, 0.26, 0);
    shoulders.userData.figPart = "body";
    slot.add(shoulders);

    const head = new THREE.Mesh(
      sharedHeadGeo,
      new THREE.MeshStandardMaterial({
        color: owned ? 0xf0e6d4 : 0x4a4440,
        roughness: 0.45,
        metalness: owned ? 0.2 : 0.05,
        transparent: !owned,
        opacity: owned ? 1 : 0.4,
      }),
    );
    head.position.set(0, 0.34, 0);
    head.userData.figPart = "head";
    slot.add(head);

    const pickData = {
      kind: "figurine-slot",
      ownerId: input.ownerId,
      slotIndex: i,
      owned,
      activatable: owned,
    };
    slot.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.userData = { ...obj.userData, ...pickData };
      }
    });
    slot.userData = {
      ...pickData,
      idleOwned: owned,
      baseY,
      phase: i * 0.7,
    };

    slot.position.set(x, baseY, z);
    group.add(slot);
  }

  return group;
}

/** Sync owned/locked look without rebuilding the whole board. */
export function syncFigurineOwnership(
  root: THREE.Group,
  ownedCount: number,
  accent: number,
): void {
  for (const child of root.children) {
    if (!(child instanceof THREE.Group)) continue;
    const slotIndex = Number(child.userData.slotIndex);
    if (Number.isNaN(slotIndex)) continue;
    const owned = slotIndex < ownedCount;
    child.userData.owned = owned;
    child.userData.activatable = owned;
    child.userData.idleOwned = owned;

    child.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.userData.owned = owned;
      obj.userData.activatable = owned;
      const mat = obj.material as THREE.MeshStandardMaterial;
      if (!mat || !("color" in mat)) return;
      const role = String(obj.userData.figPart ?? "");
      if (role === "head") {
        mat.color.setHex(owned ? 0xf0e6d4 : 0x4a4440);
        mat.transparent = !owned;
        mat.opacity = owned ? 1 : 0.4;
        mat.metalness = owned ? 0.2 : 0.05;
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      } else if (role === "pedestal") {
        mat.color.setHex(owned ? 0x3a2e20 : 0x1a1a1a);
        mat.metalness = owned ? 0.55 : 0.1;
        mat.transparent = false;
        mat.opacity = 1;
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      } else {
        mat.color.setHex(owned ? accent : 0x2e2a28);
        mat.transparent = !owned;
        mat.opacity = owned ? 1 : 0.38;
        mat.metalness = owned ? 0.55 : 0.08;
        mat.emissive.setHex(owned ? accent : 0x000000);
        mat.emissiveIntensity = owned ? 0.18 : 0;
      }
      mat.needsUpdate = true;
    });
  }
}

export function tickFigurineIdle(root: THREE.Group, timeSec: number): void {
  for (const child of root.children) {
    if (!(child instanceof THREE.Group)) continue;
    if (!child.userData.idleOwned) {
      child.position.y = Number(child.userData.baseY) || 0.2;
      continue;
    }
    const baseY = Number(child.userData.baseY) || 0.2;
    const phase = Number(child.userData.phase) || 0;
    child.position.y = baseY + Math.sin(timeSec * 2.1 + phase) * 0.025;
  }
}
