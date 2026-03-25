"use client"

import { useRef, useEffect, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment, Html, ContactShadows, useAnimations } from "@react-three/drei"
import * as THREE from "three"

interface AnimatedModelProps {
  url: string
}

function AnimatedModel({ url }: AnimatedModelProps) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(url)
  const { actions, mixer } = useAnimations(animations, group)

  useEffect(() => {
    // Play the first animation if available (walking animation)
    if (actions && Object.keys(actions).length > 0) {
      const firstAction = Object.values(actions)[0]
      if (firstAction) {
        firstAction.reset().fadeIn(0.5).play()
      }
    }

    return () => {
      mixer?.stopAllAction()
    }
  }, [actions, mixer])

  // Auto-rotate if no animation
  useFrame((state, delta) => {
    if (group.current && Object.keys(actions || {}).length === 0) {
      group.current.rotation.y += delta * 0.5
    }
  })

  // Center and scale the model
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 2 / maxDim
      
      scene.scale.setScalar(scale)
      scene.position.x = -center.x * scale
      scene.position.y = -box.min.y * scale
      scene.position.z = -center.z * scale
    }
  }, [scene])

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading model...</p>
      </div>
    </Html>
  )
}

interface ModelViewerProps {
  modelUrl: string
  animationUrl?: string
}

export function ModelViewer({ modelUrl, animationUrl }: ModelViewerProps) {
  // Use animated model URL if available, otherwise use the base model
  const displayUrl = animationUrl || modelUrl

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden bg-secondary/30">
      <Canvas
        camera={{ position: [0, 1.5, 4], fov: 45 }}
        shadows
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[5, 10, 5]} 
          intensity={1} 
          castShadow 
          shadow-mapSize={[1024, 1024]}
        />
        <spotLight
          position={[-5, 10, -5]}
          intensity={0.5}
          angle={0.3}
          penumbra={1}
        />
        
        <Suspense fallback={<LoadingFallback />}>
          <AnimatedModel url={displayUrl} />
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.4}
            scale={10}
            blur={2}
            far={4}
          />
        </Suspense>
        
        <Environment preset="studio" />
        <OrbitControls
          enablePan={false}
          minDistance={2}
          maxDistance={10}
          target={[0, 1, 0]}
        />
      </Canvas>
      
      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 rounded-lg bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  )
}
