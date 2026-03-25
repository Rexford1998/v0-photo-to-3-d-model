"use client"

import { useRef, useEffect, Suspense, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment, Html, ContactShadows, useAnimations } from "@react-three/drei"
import * as THREE from "three"
import { ErrorBoundary } from "react-error-boundary"

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

function ModelErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-secondary/30 rounded-2xl">
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="font-medium text-foreground">Failed to load 3D model</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error.message || "The model could not be loaded"}
          </p>
        </div>
        <button
          onClick={resetErrorBoundary}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

interface ModelViewerProps {
  modelUrl: string
  animationUrl?: string
}

export function ModelViewer({ modelUrl, animationUrl }: ModelViewerProps) {
  // Use animated model URL if available, otherwise use the base model
  const displayUrl = animationUrl || modelUrl
  const [key, setKey] = useState(0)

  return (
    <ErrorBoundary 
      FallbackComponent={ModelErrorFallback}
      onReset={() => setKey(prev => prev + 1)}
      resetKeys={[displayUrl, key]}
    >
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
    </ErrorBoundary>
  )
}
