import * as THREE from "three";

/** Geometric white skull centerpiece — speakeasy table icon (not a licensed asset). */
export function createWhiteSkull(): THREE.Group {
  const group = new THREE.Group();
  group.name = "white-skull";

  const bone = new THREE.MeshStandardMaterial({
    color: 0xf2ebe0,
    roughness: 0.42,
    metalness: 0.08,
    emissive: 0x1a1510,
    emissiveIntensity: 0.12,
  });
  const voidMat = new THREE.MeshStandardMaterial({
    color: 0x0a0808,
    roughness: 0.9,
    metalness: 0,
  });

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.44, 28, 20), bone);
  cranium.position.y = 0.58;
  cranium.scale.set(1.02, 0.96, 1.08);
  group.add(cranium);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.24, 0.42), bone);
  jaw.position.set(0, 0.24, 0.06);
  group.add(jaw);

  const cheekL = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 12),
    bone,
  );
  cheekL.position.set(-0.22, 0.38, 0.18);
  cheekL.scale.set(1, 0.85, 0.9);
  group.add(cheekL);
  const cheekR = cheekL.clone();
  cheekR.position.x = 0.22;
  group.add(cheekR);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 14), voidMat);
  leftEye.position.set(-0.15, 0.6, 0.34);
  group.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.15;
  group.add(rightEye);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.13, 3), voidMat);
  nose.position.set(0, 0.46, 0.4);
  nose.rotation.x = Math.PI;
  group.add(nose);

  // Soft brass under-glow (restrained — not neon)
  const glow = new THREE.PointLight(0xd4b06a, 0.55, 3.2, 2);
  glow.position.set(0, 0.15, 0);
  group.add(glow);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.08, 24),
    new THREE.MeshStandardMaterial({
      color: 0x2a2118,
      metalness: 0.55,
      roughness: 0.35,
      emissive: 0x3a2810,
      emissiveIntensity: 0.2,
    }),
  );
  pedestal.position.y = 0.04;
  group.add(pedestal);

  group.userData.idle = true;
  return group;
}
