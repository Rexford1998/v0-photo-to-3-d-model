"use client"

// 3D Model Viewer Component - Displays GLB models with animations
// Uses React Three Fiber for rendering and Three.js r152+ for 3D
import { useRef, useEffect, Suspense, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment, Html, ContactShadows, useAnimations } from "@react-three/drei"
import * as THREE from "three"

interface AnimatedModelProps {
  url: string
}

interface ModelViewerProps {
  modelUrl: string
  animationUrl?: string
}

// Helper to ensure URLs are proxied to avoid CORS issues
function getProxiedUrl(url: string): string {
  if (!url) return url
  if (url.startsWith("/api/proxy-model") || url.startsWith("/") || url.startsWith("blob:")) {
    return url
  }
  return `/api/proxy-model?url=${encodeURIComponent(url)}`
}

function AnimatedModel({ url }: AnimatedModelProps) {
  const group = useRef<THREE.Group>(null)
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
        if (node instanceof THREE.Mesh) {
          node.castShadow = true
          node.receiveShadow = true
          
          if (Array.isArray(node.material)) {
            node.material.forEach((mat) => {
              if (mat instanceof THREE.Material) {
                mat.side = THREE.FrontSide
                if (mat instanceof THREE.MeshStandardMaterial) {
                  mat.metalness = 0.3
                  mat.roughness = 0.8
                  mat.envMapIntensity = 1.5
                }
              }
            })
          } else if (node.material instanceof THREE.Material) {
            node.material.side = THREE.FrontSide
            if (node.material instanceof THREE.MeshStandardMaterial) {
              node.material.metalness = 0.3
              node.material.roughness = 0.8
              node.material.envMapIntensity = 1.5
            }
          }
        }
      })
      
      const box = new THREE.Box3().setFromObject(scene)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
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

class ModelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
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
                {this.state.error?.message || "The model could not be loaded"}
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function ModelViewer({ modelUrl, animationUrl }: ModelViewerProps) {
  const displayUrl = animationUrl || modelUrl
  const proxiedUrl = getProxiedUrl(displayUrl)

  return (
    <ModelErrorBoundary>
      <div className="relative h-full w-full rounded-2xl overflow-hidden bg-secondary/30">
        <Canvas
          camera={{ position: [0, 1.5, 4], fov: 45 }}
          shadows
          dpr={[1, 2]}
          gl={{ 
            antialias: true, 
            alpha: true,
            toneMappingExposure: 1.0,
          }}
        >
          <ambientLight intensity={1} />
          <directionalLight 
            position={[10, 15, 10]} 
            intensity={1.5} 
            castShadow 
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0001}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
            shadow-camera-far={100}
          />
          <directionalLight position={[-10, 10, 5]} intensity={0.6} />
          <directionalLight position={[0, 5, -10]} intensity={0.5} />
          
          <Suspense fallback={<LoadingFallback />}>
            <AnimatedModel url={proxiedUrl} />
            <ContactShadows
              position={[0, 0, 0]}
              opacity={0.6}
              scale={15}
              blur={2.5}
              far={5}
            />
          </Suspense>
          
          <Environment preset="studio" intensity={1.2} />
          <OrbitControls
            enablePan={false}
            minDistance={2}
            maxDistance={10}
            target={[0, 1, 0]}
          />
        </Canvas>

        <div className="absolute bottom-4 left-4 rounded-lg bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
          Drag to rotate • Scroll to zoom
        </div>
      </div>
    </ModelErrorBoundary>
  )
}
