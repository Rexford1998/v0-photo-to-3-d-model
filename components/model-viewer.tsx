"use client"

// Model viewer for displaying 3D GLB models with animations - v2
import React, { useRef, useEffect, Suspense, useState, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment, Html, ContactShadows, useAnimations } from "@react-three/drei"
import { Group, Mesh, Material, MeshStandardMaterial, Box3, Vector3, FrontSide } from "three"

// Helper to ensure URLs are proxied to avoid CORS issues
function getProxiedUrl(url: string): string {
  if (!url) return url
  if (url.startsWith("/api/proxy-model") || url.startsWith("/") || url.startsWith("blob:")) {
    return url
  }
  return `/api/proxy-model?url=${encodeURIComponent(url)}`
}

interface AnimatedModelProps {
  url: string
}

function AnimatedModel({ url }: AnimatedModelProps) {
  const group = useRef<Group>(null)
  const { scene, animations } = useGLTF(url)
  const { actions, mixer } = useAnimations(animations, group)

  useEffect(() => {
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

  useFrame((_, delta) => {
    if (group.current && Object.keys(actions || {}).length === 0) {
      group.current.rotation.y += delta * 0.5
    }
  })

  useEffect(() => {
    if (scene) {
      scene.traverse((node) => {
        if (node instanceof Mesh) {
          node.castShadow = true
          node.receiveShadow = true
          
          const materials = Array.isArray(node.material) ? node.material : [node.material]
          materials.forEach((mat) => {
            if (mat instanceof Material) {
              mat.side = FrontSide
              if (mat instanceof MeshStandardMaterial) {
                mat.metalness = 0.3
                mat.roughness = 0.7
                mat.envMapIntensity = 1.5
              }
            }
          })
        }
      })
      
      const box = new Box3().setFromObject(scene)
      const center = box.getCenter(new Vector3())
      const size = box.getSize(new Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 2.5 / maxDim
      
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
  const displayUrl = useMemo(() => getProxiedUrl(animationUrl || modelUrl), [animationUrl, modelUrl])
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary/30 rounded-2xl">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-sm text-muted-foreground">Failed to load model</p>
          <button
            onClick={() => setHasError(false)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden bg-secondary/30">
      <Canvas
        camera={{ position: [0, 1.5, 4], fov: 45 }}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onError={() => setHasError(true)}
      >
        <ambientLight intensity={1} />
        <directionalLight 
          position={[10, 15, 10]} 
          intensity={1.5} 
          castShadow 
        />
        <directionalLight position={[-10, 10, 5]} intensity={0.6} />
        
        <Suspense fallback={<LoadingFallback />}>
          <AnimatedModel url={displayUrl} />
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.6}
            scale={15}
            blur={2.5}
            far={5}
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

      <div className="absolute bottom-4 left-4 rounded-lg bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
        Drag to rotate - Scroll to zoom
      </div>
    </div>
  )
}
