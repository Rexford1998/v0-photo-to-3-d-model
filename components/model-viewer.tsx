"use client"

import { useRef, useEffect, Suspense, useState, useCallback, Component, ReactNode } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment, Html, ContactShadows, useAnimations } from "@react-three/drei"
import { Group, Mesh, MeshStandardMaterial, Box3, Vector3, CanvasTexture, SRGBColorSpace, FrontSide } from "three"

function getProxiedUrl(url: string): string {
  if (!url) return url
  if (url.startsWith("/api/proxy-model") || url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url
  }
  return `/api/proxy-model?url=${encodeURIComponent(url)}`
}

class ErrorBoundary extends Component<
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
    if (this.state.hasError) return null
    return this.props.children
  }
}

interface ModelProps {
  url: string
  textureUrl?: string
}

function Model({ url, textureUrl }: ModelProps) {
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
    if (!textureUrl) return

    const img = new Image()
    if (!textureUrl.startsWith('data:')) {
      img.crossOrigin = "anonymous"
    }
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const tex = new CanvasTexture(canvas)
      tex.colorSpace = SRGBColorSpace

      scene.traverse((node) => {
        if (node instanceof Mesh && node.material instanceof MeshStandardMaterial) {
          node.material.map = tex
          node.material.needsUpdate = true
        }
      })
    }
    img.src = textureUrl
  }, [textureUrl, scene])

  useEffect(() => {
    if (scene) {
      scene.traverse((node) => {
        if (node instanceof Mesh) {
          node.castShadow = true
          node.receiveShadow = true
          if (node.material instanceof MeshStandardMaterial) {
            node.material.side = FrontSide
            node.material.envMapIntensity = 1.2
          }
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

function Loader() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading model...</p>
      </div>
    </Html>
  )
}

interface ViewerProps {
  modelUrl: string
  animationUrl?: string
  textureUrl?: string
}

export function ModelViewer({ modelUrl, animationUrl, textureUrl }: ViewerProps) {
  const displayUrl = getProxiedUrl(animationUrl || modelUrl)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const handleError = useCallback((err: Error) => {
    setError(err)
  }, [])

  const handleRetry = () => {
    setError(null)
    setRetryKey((prev) => prev + 1)
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
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">Please try generating a new model.</p>
          </div>
          <button onClick={handleRetry} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden bg-secondary/30">
      <ErrorBoundary onError={handleError} resetKey={retryKey}>
        <Canvas key={retryKey} camera={{ position: [0, 1.5, 4], fov: 45 }} shadows gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[8, 12, 6]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
          <pointLight position={[-6, 8, -6]} intensity={0.6} />

          <Suspense fallback={<Loader />}>
            <Model url={displayUrl} textureUrl={textureUrl} />
            <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={12} blur={2.5} far={4} />
          </Suspense>

          <Environment preset="studio" />
          <OrbitControls enablePan={false} minDistance={2} maxDistance={10} target={[0, 1, 0]} />
        </Canvas>
      </ErrorBoundary>

      <div className="absolute bottom-4 left-4 rounded-lg bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
        Drag to rotate | Scroll to zoom
      </div>
    </div>
  )
}
