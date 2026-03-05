import { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { Environment } from "@react-three/drei";
import { Mesh } from "three";
import { HalftoneMonoEffect } from "./HalftoneEffect";

function RotatingTorus() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.25;
      meshRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <mesh ref={meshRef} scale={1.7}>
      <torusGeometry args={[1, 0.4, 64, 128]} />
      <meshStandardMaterial
        color="#999"
        metalness={0.85}
        roughness={0.15}
      />
    </mesh>
  );
}

function SceneContents() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1.94} />
      <pointLight position={[-3, -2, 4]} intensity={2} />

      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={1.8} />
      </Suspense>

      <RotatingTorus />

      <EffectComposer>
        <HalftoneMonoEffect
          colorBackground="#dbd6cc"
          colorForeground="#050505"
          dotSize={1.35}
          contrast={1.35}
          spread={0.48}
        />
      </EffectComposer>
    </>
  );
}

export function HalftoneScene({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, 2));
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0, 4], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "#dbd6cc" }}
      >
        <SceneContents />
      </Canvas>
    </div>
  );
}
