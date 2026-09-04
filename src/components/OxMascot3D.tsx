import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createOxMascotModel, OxMascotModelApi } from "../three/createOxMascotModel";
import OxMascot from "./OxMascot";

interface OxMascot3DProps {
  className?: string;
  size?: number;
}

export default function OxMascot3D({ className = "", size = 260 }: OxMascot3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const [isDebugExploded, setIsDebugExploded] = useState(() => {
    return typeof window !== "undefined" && window.location.search.includes("debug3d=1");
  });
  const [explodeValue, setExplodeValue] = useState(0);

  const modelApiRef = useRef<OxMascotModelApi | null>(null);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check prefers-reduced-motion
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Test WebGL support
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "default",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(size, size);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      setWebglAvailable(true);
    } catch {
      setWebglAvailable(false);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0.4, 4.2);
    camera.lookAt(0, 0.1, 0);

    // Controlled Studio Lighting (no additional particles/bloom)
    const ambientLight = new THREE.AmbientLight(0xd6f0e6, 1.1);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(2.5, 3.5, 3.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x5fe8c3, 0.7);
    fillLight.position.set(-2.5, 1.0, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffc35c, 0.9);
    rimLight.position.set(0, 3.0, -2.5);
    scene.add(rimLight);

    // Build procedural mascot model
    const model = createOxMascotModel({ exploded: isDebugExploded });
    scene.add(model.group);
    modelApiRef.current = model;

    // IntersectionObserver to ONLY render when near viewport
    let isVisible = false;
    let rafId = 0;

    const render = () => {
      renderer.render(scene, camera);
    };

    const animateLoop = () => {
      if (!isVisible || document.hidden) {
        rafId = 0;
        return;
      }
      render();
      rafId = requestAnimationFrame(animateLoop);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isVisible = entry.isIntersecting;
        if (isVisible) {
          if (reduced) {
            // Render single frame for reduced motion
            render();
          } else if (!rafId) {
            rafId = requestAnimationFrame(animateLoop);
          }
        }
      },
      { rootMargin: "150px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      } else if (isVisible && !reduced && !rafId) {
        rafId = requestAnimationFrame(animateLoop);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial render
    render();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (rafId) cancelAnimationFrame(rafId);
      model.dispose();
      renderer.dispose();
      modelApiRef.current = null;
    };
  }, [size, isDebugExploded]);

  // Pointer tracking interaction (clamped to max 8deg, no react state re-render)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!modelApiRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    modelApiRef.current.lookAt(x, y);
  };

  const handlePointerLeave = () => {
    if (!modelApiRef.current) return;
    modelApiRef.current.lookAt(0, 0);
  };

  const handleClick = () => {
    if (!modelApiRef.current || isInteractingRef.current) return;
    isInteractingRef.current = true;
    modelApiRef.current.acknowledge();
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 600);
  };

  const handleExplodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setExplodeValue(val);
    modelApiRef.current?.setExploded(val);
  };

  if (webglAvailable === false) {
    return <OxMascot mood="idle" size={size} className={className} />;
  }

  return (
    <div
      ref={containerRef}
      className={`ox-mascot-3d-wrap ${className}`}
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="ox-α 3D Mascote Procedural. Clique para interagir."
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          cursor: "pointer",
          filter: "drop-shadow(0 14px 24px rgba(4, 20, 24, 0.45))",
        }}
      />

      {/* Badge interativa discreta na base */}
      <span
        style={{
          position: "absolute",
          bottom: 6,
          fontSize: "9px",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.18em",
          color: "var(--faint)",
          textTransform: "uppercase",
          pointerEvents: "none",
        }}
      >
        ox-α · 3d bancada assist
      </span>

      {/* Exploded Hierarchy Inspector for ?debug3d=1 */}
      {isDebugExploded && (
        <div
          style={{
            position: "absolute",
            top: -40,
            left: 0,
            right: 0,
            background: "rgba(9,11,12,0.9)",
            border: "1px solid var(--phos)",
            padding: "4px 8px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            color: "var(--phos)",
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span>Explodir 3D:</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={explodeValue}
            onChange={handleExplodeChange}
            style={{ flex: 1 }}
          />
          <span>{(explodeValue * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
