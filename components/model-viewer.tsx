"use client"

import { useRef, useEffect, Suspense, useState, useCallback, Component, ReactNode } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment, Html, ContactShadows, useAnimations } from "@react-three/drei"
import * as THREE from "three"

// Error boundary for catching Three.js/useGLTF errors
class ModelErrorBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void; resetKey: number },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: (error: Error) => void; resetKey: number }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  componentDidUpdate(prevProps: { resetKey: number }) {
    if (prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}

interface AnimatedModelProps {
  url: string
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
  const displayUrl = animationUrl || modelUrl
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const handleError = useCallback((err: Error) => {
    setError(err)
  }, [])

  const handleRetry = () => {
    setError(null)
    setRetryKey(prev => prev + 1)
    // Clear the GLTF cache for this URL
    useGLTF.clear(displayUrl)
  }

  useEffect(() => {
    setError(null)
  }, [displayUrl])

  if (error) {
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
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              The model could not be loaded. Please try generating a new model.
            </p>
          </div>
          <button
            onClick={handleRetry}
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
      <ModelErrorBoundary onError={handleError} resetKey={retryKey}>
        <Canvas
          key={retryKey}
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
      </ModelErrorBoundary>
      
      <div className="absolute bottom-4 left-4 rounded-lg bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  )
}
