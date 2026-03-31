"use client"

/**
 * 3D Model Viewer Component
 * Displays GLB models with orbit controls
 * Uses solid background color to avoid HDR rate limits
 * Updated: Forces cache invalidation
 */
import { useRef, useEffect, Suspense, useState, useCallback, Component, ReactNode, useMemo } from "react"
import { Canvas, useFrame, useGraph } from "@react-three/fiber"
import { OrbitControls, useGLTF, Html, ContactShadows, useAnimations, KeyboardControls, useKeyboardControls } from "@react-three/drei"
import { Group, Mesh, MeshStandardMaterial, Box3, Vector3, FrontSide, TextureLoader, SRGBColorSpace, Object3D, MathUtils } from "three"
import { SkeletonUtils } from "three-stdlib"
import dynamic from "next/dynamic"

const Ecctrl = dynamic(() => import("ecctrl"), { ssr: false })

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

// We need to fetch the original model to get its textures and materials, then map it to the animated model's meshes.
function useModelWithOriginalMaterials(animatedUrl: string, originalUrl: string | null) {
  const { scene: animatedScene, animations } = useGLTF(animatedUrl)
  // Original static scene which has the materials
  const { scene: originalScene } = useGLTF(originalUrl || animatedUrl)

  // Clone to avoid mutating cached GLTF
  const clone = useMemo(() => SkeletonUtils.clone(animatedScene), [animatedScene])
  const { nodes } = useGraph(clone)

  useEffect(() => {
    if (originalScene && originalUrl !== animatedUrl) {
      // Find the material from the original scene
      let originalMaterial: MeshStandardMaterial | null = null
      originalScene.traverse((child) => {
        if (child instanceof Mesh && child.material) {
          originalMaterial = child.material as MeshStandardMaterial
        }
      })

      if (originalMaterial) {
        // Apply to animated scene
        Object.values(nodes).forEach((node) => {
          if (node instanceof Mesh) {
            node.material = originalMaterial
          }
        })
      }
    }
  }, [originalScene, nodes, originalUrl, animatedUrl])

  return { scene: clone, animations }
}

interface AnimatedModelProps extends ModelProps {
  originalModelUrl?: string
  isWalkingMode?: boolean
}

function Model({ url, originalModelUrl, isWalkingMode }: AnimatedModelProps) {
  const group = useRef<Group>(null)

  const { scene, animations } = useModelWithOriginalMaterials(url, originalModelUrl || url)
  const { actions, mixer } = useAnimations(animations, group)

  // Only safely call useKeyboardControls if we are in walking mode, because KeyboardControls provider
  // might not exist otherwise (although we wrapped Canvas in it, so it's fine).
  const getKeys = useKeyboardControls((state) => state)

  useEffect(() => {
    // Play the animation
    if (actions && Object.keys(actions).length > 0) {
      const firstAction = Object.values(actions)[0]
      if (firstAction) {
        firstAction.reset().fadeIn(0.5).play()
        if (isWalkingMode) {
          firstAction.timeScale = 0 // start paused until moving
        }
      }
    }
    return () => {
      mixer?.stopAllAction()
    }
  }, [actions, mixer, isWalkingMode])

  useFrame((_, delta) => {
    if (!isWalkingMode && group.current && Object.keys(actions || {}).length === 0) {
      group.current.rotation.y += delta * 0.5
    }

    // Animate walking based on keyboard input
    if (isWalkingMode && actions && Object.keys(actions).length > 0) {
      const firstAction = Object.values(actions)[0]
      if (firstAction && getKeys) {
        const { forward, backward, left, right } = getKeys
        const isMoving = forward || backward || left || right
        // smoothly transition timeScale based on movement
        firstAction.timeScale = MathUtils.lerp(firstAction.timeScale, isMoving ? 1.5 : 0, 0.15)
      }
    }
  })

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

      if (!isWalkingMode) {
        const box = new Box3().setFromObject(scene)
        const center = box.getCenter(new Vector3())
        const size = box.getSize(new Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 2.5 / maxDim

        scene.scale.setScalar(scale)
        scene.position.x = -center.x * scale
        scene.position.y = -box.min.y * scale
        scene.position.z = -center.z * scale
      } else {
        // In walking mode, just reset transform and scale to something reasonable
        scene.scale.setScalar(1)
        scene.position.set(0, -0.9, 0) // Shift down to match capsule collider
      }
    }
  }, [scene, isWalkingMode])

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

export function ModelViewer({ modelUrl, animationUrl }: ViewerProps) {
  const displayUrl = getProxiedUrl(animationUrl || modelUrl)
  const originalUrl = getProxiedUrl(modelUrl)

  const isWalkingMode = !!animationUrl

  // Keyboard controls for Ecctrl
  const keyboardMap = [
    { name: "forward", keys: ["ArrowUp"] },
    { name: "backward", keys: ["ArrowDown"] },
    { name: "left", keys: ["ArrowLeft"] },
    { name: "right", keys: ["ArrowRight"] },
    { name: "jump", keys: ["Space"] },
    { name: "run", keys: ["Shift"] },
  ]
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
        <KeyboardControls map={keyboardMap}>
          <Canvas key={retryKey} camera={{ position: [0, 1.5, 4], fov: 45 }} shadows gl={{ antialias: true, alpha: true }}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[8, 12, 6]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
            <pointLight position={[-6, 8, -6]} intensity={0.6} />

            <Suspense fallback={<Loader />}>
              {isWalkingMode ? (
                <WalkingModelContent displayUrl={displayUrl} originalUrl={originalUrl} />
              ) : (
                <>
                  <Model url={displayUrl} originalModelUrl={originalUrl} isWalkingMode={false} />
                  <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={12} blur={2.5} far={4} />
                  <OrbitControls enablePan={false} minDistance={2} maxDistance={10} target={[0, 1, 0]} />
                </>
              )}
            </Suspense>

            {/* Sky background color instead of HDR to avoid rate limits */}
            <color attach="background" args={["#f0f4f8"]} />
          </Canvas>
        </KeyboardControls>
      </ErrorBoundary>

      <div className="absolute bottom-4 left-4 rounded-lg bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
        {isWalkingMode ? "Click to focus | Arrow keys to move | Mouse to look" : "Drag to rotate | Scroll to zoom"}
      </div>
    </div>
  )
}

// Lazy-load walking mode to avoid chunk loading issues
function WalkingModelContent({ displayUrl, originalUrl }: { displayUrl: string; originalUrl: string }) {
  return (
    <Suspense fallback={<Loader />}>
      <WalkingModelAsync displayUrl={displayUrl} originalUrl={originalUrl} />
    </Suspense>
  )
}

function WalkingModelAsync({ displayUrl, originalUrl }: { displayUrl: string; originalUrl: string }) {
  // Dynamically import Physics only when needed
  const [PhysicsModule, setPhysicsModule] = useState<any>(null)
  const [ecctrlReady, setEcctrlReady] = useState(false)

  useEffect(() => {
    Promise.all([
      import("@react-three/rapier").then((mod) => {
        setPhysicsModule({ Physics: mod.Physics, RigidBody: mod.RigidBody })
      }),
      new Promise(resolve => setTimeout(() => { setEcctrlReady(true); resolve(null) }, 100))
    ]).catch(err => console.error("[v0] Failed to load modules:", err))
  }, [])

  if (!PhysicsModule || !ecctrlReady) return <Loader />

  const { Physics, RigidBody } = PhysicsModule

  return (
    <>
      <Physics timeStep="vary">
        <Suspense fallback={<Loader />}>
          <Ecctrl animated={true} camInitDis={-5} camMaxDis={-7} maxVelLimit={3}>
            <Model url={displayUrl} originalModelUrl={originalUrl} isWalkingMode={true} />
          </Ecctrl>
        </Suspense>
        {/* Beach floor plane */}
        <RigidBody type="fixed" colliders="trimesh">
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#e6d4ba" />
          </mesh>
        </RigidBody>
      </Physics>
    </>
  )
}
