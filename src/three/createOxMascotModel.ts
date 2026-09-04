import * as THREE from "three";
import gsap from "gsap";
import { MOTION } from "../lib/motionTokens";

export interface OxMascotModelApi {
  group: THREE.Group;
  lookAt: (ndcX: number, ndcY: number) => void;
  acknowledge: () => void;
  setMood: (mood: "idle" | "happy" | "excited") => void;
  setExploded: (amount: number) => void;
  dispose: () => void;
}

export interface OxMascotOptions {
  seed?: number;
  initialMood?: "idle" | "happy" | "excited";
  exploded?: boolean;
}

/**
 * Creates a deterministic procedural canvas texture for the chest badge "ox-α"
 */
function createBadgeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#5fe8c3";
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 112, 48);
    ctx.fill();

    ctx.strokeStyle = "#17604e";
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.fillStyle = "#0e242c";
    ctx.font = "bold 60px 'Space Grotesk', 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ox-α", 128, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a rounded rectangle 2D shape for the visor
 */
function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return shape;
}

/**
 * Creates the procedural 3D ox-α mascot model following the img2threejs specification.
 */
export function createOxMascotModel(options: OxMascotOptions = {}): OxMascotModelApi {
  const rootGroup = new THREE.Group();
  rootGroup.name = "oxMascotRoot";

  // Semantic Pivots
  const bodyPivot = new THREE.Group();
  bodyPivot.name = "bodyPivot";
  rootGroup.add(bodyPivot);

  const headPivot = new THREE.Group();
  headPivot.name = "headPivot";
  headPivot.position.set(0, 0.15, 0);
  bodyPivot.add(headPivot);

  const antennaPivot = new THREE.Group();
  antennaPivot.name = "antennaPivot";
  antennaPivot.position.set(0, 0.95, 0);
  headPivot.add(antennaPivot);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.name = "leftArmPivot";
  leftArmPivot.position.set(-0.72, 0.05, 0);
  bodyPivot.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.name = "rightArmPivot";
  rightArmPivot.position.set(0.72, 0.05, 0);
  bodyPivot.add(rightArmPivot);

  const eyesGroup = new THREE.Group();
  eyesGroup.name = "eyesGroup";
  eyesGroup.position.set(0, 0.22, 0.62);
  headPivot.add(eyesGroup);

  // Materials
  const chassisMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9fbf3,
    roughness: 0.26,
    metalness: 0.08,
  });

  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0x17604e,
    roughness: 0.4,
    metalness: 0.2,
  });

  const visorMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a1a20,
    roughness: 0.1,
    metalness: 0.45,
  });

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x5fe8c3,
    emissive: 0x5fe8c3,
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });

  const eyeHighlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  const mouthMaterial = new THREE.MeshStandardMaterial({
    color: 0x5fe8c3,
    emissive: 0x3ac8a0,
    emissiveIntensity: 1.0,
    roughness: 0.2,
  });

  const blushMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8a68,
    roughness: 0.6,
    metalness: 0.05,
    transparent: true,
    opacity: 0.55,
  });

  const antennaStemMaterial = new THREE.MeshStandardMaterial({
    color: 0x17604e,
    roughness: 0.35,
    metalness: 0.5,
  });

  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc35c,
    emissive: 0xff9c2a,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });

  const badgeTexture = createBadgeTexture();
  const badgeMaterial = new THREE.MeshBasicMaterial({
    map: badgeTexture,
    transparent: true,
  });

  // Explode tracking
  interface ExplodePart {
    object: THREE.Object3D;
    initialPos: THREE.Vector3;
    explodeOffset: THREE.Vector3;
  }
  const explodeParts: ExplodePart[] = [];

  function registerExplode(obj: THREE.Object3D, offset: THREE.Vector3) {
    explodeParts.push({
      object: obj,
      initialPos: obj.position.clone(),
      explodeOffset: offset.clone(),
    });
  }

  // 1. Body Chassis (Macro)
  const bodyMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.72, 0.7, 16, 28),
    chassisMaterial
  );
  bodyMesh.position.set(0, 0.05, 0);
  bodyMesh.scale.set(1.05, 1.0, 0.88);
  bodyPivot.add(bodyMesh);
  registerExplode(bodyMesh, new THREE.Vector3(0, 0, 0));

  // Outer green accent trim ring around chassis
  const chassisTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.03, 12, 32),
    borderMaterial
  );
  chassisTrim.position.set(0, 0.05, 0);
  chassisTrim.rotation.x = Math.PI / 2;
  bodyPivot.add(chassisTrim);
  registerExplode(chassisTrim, new THREE.Vector3(0, 0, -0.2));

  // 2. Visor (Meso) with rounded corners
  const visorShape = createRoundedRectShape(0.88, 0.58, 0.18);
  const visorGeom = new THREE.ExtrudeGeometry(visorShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });
  visorGeom.center();
  const visorMesh = new THREE.Mesh(visorGeom, visorMaterial);
  visorMesh.position.set(0, 0.22, 0.54);
  headPivot.add(visorMesh);
  registerExplode(visorMesh, new THREE.Vector3(0, 0.1, 0.75));

  // Visor Bezel
  const bezelShape = createRoundedRectShape(0.94, 0.64, 0.2);
  const bezelGeom = new THREE.ExtrudeGeometry(bezelShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  bezelGeom.center();
  const bezelMesh = new THREE.Mesh(bezelGeom, borderMaterial);
  bezelMesh.position.set(0, 0.22, 0.50);
  headPivot.add(bezelMesh);
  registerExplode(bezelMesh, new THREE.Vector3(0, 0.1, 0.45));

  // 3. Antenna (Meso)
  const antennaStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.32, 16),
    antennaStemMaterial
  );
  antennaStem.position.set(0, 0.16, 0);
  antennaPivot.add(antennaStem);

  const antennaRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.018, 12, 24),
    beaconMaterial
  );
  antennaRing.position.set(0, 0.34, 0);
  antennaPivot.add(antennaRing);

  const antennaBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 16),
    beaconMaterial
  );
  antennaBeacon.position.set(0, 0.34, 0);
  antennaPivot.add(antennaBeacon);
  registerExplode(antennaPivot, new THREE.Vector3(0, 0.7, 0));

  // 4. Arms & Feet (Meso)
  // Left arm
  const leftArmMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.09, 0.26, 12, 16),
    chassisMaterial
  );
  leftArmMesh.position.set(-0.12, -0.08, 0.04);
  leftArmMesh.rotation.z = 0.45;
  leftArmPivot.add(leftArmMesh);

  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 16),
    chassisMaterial
  );
  leftHand.position.set(-0.24, -0.20, 0.04);
  leftArmPivot.add(leftHand);
  registerExplode(leftArmPivot, new THREE.Vector3(-0.7, 0, 0));

  // Right arm
  const rightArmMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.09, 0.26, 12, 16),
    chassisMaterial
  );
  rightArmMesh.position.set(0.12, -0.08, 0.04);
  rightArmMesh.rotation.z = -0.45;
  rightArmPivot.add(rightArmMesh);

  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 16),
    chassisMaterial
  );
  rightHand.position.set(0.24, -0.20, 0.04);
  rightArmPivot.add(rightHand);
  registerExplode(rightArmPivot, new THREE.Vector3(0.7, 0, 0));

  // Feet (peeking under the base)
  const leftFoot = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.11, 0.18, 12, 16),
    chassisMaterial
  );
  leftFoot.position.set(-0.28, -0.66, 0.12);
  leftFoot.rotation.x = Math.PI / 2.3;
  bodyPivot.add(leftFoot);
  registerExplode(leftFoot, new THREE.Vector3(-0.2, -0.5, 0.1));

  const rightFoot = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.11, 0.18, 12, 16),
    chassisMaterial
  );
  rightFoot.position.set(0.28, -0.66, 0.12);
  rightFoot.rotation.x = Math.PI / 2.3;
  bodyPivot.add(rightFoot);
  registerExplode(rightFoot, new THREE.Vector3(0.2, -0.5, 0.1));

  // 5. Micro details: Eyes, Cheeks, Mouth, Badge
  // Left eye
  const leftEyeGroup = new THREE.Group();
  leftEyeGroup.position.set(-0.20, 0, 0);
  const leftEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 20, 16),
    eyeMaterial
  );
  leftEyeGroup.add(leftEye);
  const leftHighlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 12),
    eyeHighlightMaterial
  );
  leftHighlight.position.set(0.032, 0.032, 0.078);
  leftEyeGroup.add(leftHighlight);
  eyesGroup.add(leftEyeGroup);

  // Right eye
  const rightEyeGroup = new THREE.Group();
  rightEyeGroup.position.set(0.20, 0, 0);
  const rightEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 20, 16),
    eyeMaterial
  );
  rightEyeGroup.add(rightEye);
  const rightHighlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 12),
    eyeHighlightMaterial
  );
  rightHighlight.position.set(0.032, 0.032, 0.078);
  rightEyeGroup.add(rightHighlight);
  eyesGroup.add(rightEyeGroup);

  registerExplode(eyesGroup, new THREE.Vector3(0, 0.1, 0.95));

  // Mouth curve
  const mouthCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.13, 0.12, 0.63),
    new THREE.Vector3(0, 0.06, 0.64),
    new THREE.Vector3(0.13, 0.12, 0.63)
  );
  const mouthMesh = new THREE.Mesh(
    new THREE.TubeGeometry(mouthCurve, 16, 0.016, 8, false),
    mouthMaterial
  );
  headPivot.add(mouthMesh);
  registerExplode(mouthMesh, new THREE.Vector3(0, 0, 0.85));

  // Blush spots
  const leftBlush = new THREE.Mesh(
    new THREE.CircleGeometry(0.075, 16),
    blushMaterial
  );
  leftBlush.position.set(-0.38, -0.15, 0.62);
  bodyPivot.add(leftBlush);

  const rightBlush = new THREE.Mesh(
    new THREE.CircleGeometry(0.075, 16),
    blushMaterial
  );
  rightBlush.position.set(0.38, -0.15, 0.62);
  bodyPivot.add(rightBlush);

  // Chest Badge "ox-α"
  const badgePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.22),
    badgeMaterial
  );
  badgePlane.position.set(0, -0.28, 0.65);
  bodyPivot.add(badgePlane);
  registerExplode(badgePlane, new THREE.Vector3(0, -0.15, 0.55));

  // Shadow disc on floor
  const floorShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.70, 32),
    new THREE.MeshBasicMaterial({
      color: 0x02080a,
      transparent: true,
      opacity: 0.45,
    })
  );
  floorShadow.rotation.x = -Math.PI / 2;
  floorShadow.position.set(0, -0.74, 0);
  rootGroup.add(floorShadow);

  // Explode handling
  let currentExploded = options.exploded ? 1 : 0;
  const applyExplode = (amount: number) => {
    currentExploded = Math.max(0, Math.min(1, amount));
    for (const part of explodeParts) {
      part.object.position.copy(part.initialPos).addScaledVector(part.explodeOffset, currentExploded);
    }
  };
  if (currentExploded > 0) applyExplode(currentExploded);

  // Tracking lookAt calculation
  const targetHeadRot = new THREE.Euler();
  const targetEyesPos = new THREE.Vector3();

  return {
    group: rootGroup,

    lookAt(ndcX: number, ndcY: number) {
      const maxAngle = 0.14;
      targetHeadRot.y = THREE.MathUtils.clamp(ndcX * maxAngle, -maxAngle, maxAngle);
      targetHeadRot.x = THREE.MathUtils.clamp(-ndcY * (maxAngle * 0.7), -maxAngle * 0.7, maxAngle * 0.7);

      headPivot.rotation.y += (targetHeadRot.y - headPivot.rotation.y) * 0.14;
      headPivot.rotation.x += (targetHeadRot.x - headPivot.rotation.x) * 0.14;

      const maxEyeShift = 0.035;
      targetEyesPos.x = THREE.MathUtils.clamp(ndcX * maxEyeShift, -maxEyeShift, maxEyeShift);
      targetEyesPos.y = 0.22 + THREE.MathUtils.clamp(-ndcY * maxEyeShift, -maxEyeShift, maxEyeShift);
      eyesGroup.position.x += (targetEyesPos.x - eyesGroup.position.x) * 0.16;
      eyesGroup.position.y += (targetEyesPos.y - eyesGroup.position.y) * 0.16;
    },

    acknowledge() {
      // 1. Antenna beacon pulse
      gsap.fromTo(
        beaconMaterial,
        { emissiveIntensity: 2.8 },
        { emissiveIntensity: 1.5, duration: MOTION.duration.normal, ease: MOTION.ease.subtle }
      );

      // 2. Antenna flex
      gsap.fromTo(
        antennaPivot.rotation,
        { z: 0.25 },
        { z: 0, duration: MOTION.duration.slow, ease: MOTION.ease.mascotExpressive }
      );

      // 3. Head nod
      gsap.fromTo(
        headPivot.rotation,
        { x: 0.14 },
        { x: 0, duration: MOTION.duration.normal, ease: MOTION.ease.subtle }
      );

      // 4. Arm wave acknowledgement
      gsap.fromTo(
        leftArmPivot.rotation,
        { z: 1.3 },
        { z: 0, duration: MOTION.duration.slow, ease: MOTION.ease.mascotExpressive }
      );

      // 5. Eye squint (happy)
      gsap.to(eyesGroup.scale, {
        y: 0.25,
        duration: MOTION.duration.fast,
        yoyo: true,
        repeat: 1,
        ease: MOTION.ease.subtle,
      });
    },

    setMood(mood) {
      if (mood === "excited" || mood === "happy") {
        beaconMaterial.emissiveIntensity = 2.2;
        gsap.to(eyesGroup.scale, { y: 0.3, duration: 0.2, yoyo: true, repeat: 1 });
      } else {
        beaconMaterial.emissiveIntensity = 1.5;
        eyesGroup.scale.set(1, 1, 1);
      }
    },

    setExploded(amount: number) {
      applyExplode(amount);
    },

    dispose() {
      badgeTexture.dispose();
      badgeMaterial.dispose();
      chassisMaterial.dispose();
      borderMaterial.dispose();
      visorMaterial.dispose();
      eyeMaterial.dispose();
      eyeHighlightMaterial.dispose();
      mouthMaterial.dispose();
      blushMaterial.dispose();
      antennaStemMaterial.dispose();
      beaconMaterial.dispose();

      rootGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    },
  };
}
