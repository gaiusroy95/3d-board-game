import * as THREE from "three";

/** Simple original white skull placeholder (geometric, not a licensed asset). */
export function createWhiteSkull(): THREE.Group {
  const group = new THREE.Group();
  group.name = "white-skull";

  const white = new THREE.MeshStandardMaterial({
    color: 0xf4f4f4,
    roughness: 0.55,
    metalness: 0.05,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8,
    metalness: 0,
  });

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), white);
  cranium.position.y = 0.55;
  cranium.scale.set(1, 0.95, 1.05);
  group.add(cranium);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.4), white);
  jaw.position.set(0, 0.22, 0.05);
  group.add(jaw);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), dark);
  leftEye.position.set(-0.14, 0.58, 0.32);
  group.add(leftEye);

  const rightEye = leftEye.clone();
  rightEye.position.x = 0.14;
  group.add(rightEye);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 3), dark);
  nose.position.set(0, 0.45, 0.38);
  nose.rotation.x = Math.PI;
  group.add(nose);

  return group;
}
