"use client"

import { useRef, useEffect, Suspense, useState, useCallback, Component, ReactNode, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { useGLTF, Environment, Html, useAnimations, useKeyboardControls, KeyboardControls } from "@react-three/drei"
import { Group, Mesh, Material, Vector3, Box3, DoubleSide } from "three"

// Helper to ensure URLs are proxied to avoid CORS issues
function getProxiedUrl(url: string): string {
  if (!url) return url
  if (url.startsWith("/api/proxy-model") || url.startsWith("/") || url.startsWith("blob:")) {
    return url
  }
  return `/api/proxy-model?url=${encodeURIComponent(url)}`
}

// Keyboard controls mapping
enum Controls {
  forward = 'forward',
  backward = 'backward',
  left = 'left',
  right = 'right',
}

const keyboardMap = [
  { name: Controls.forward, keys: ['ArrowUp', 'KeyW'] },
  { name: Controls.backward, keys: ['ArrowDown', 'KeyS'] },
  { name: Controls.left, keys: ['ArrowLeft', 'KeyA'] },
  { name: Controls.right, keys: ['ArrowRight', 'KeyD'] },
]

// Error boundary for catching Three.js errors
class SceneErrorBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: (error: Error) => void }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

// Coffee Shop Environment Components
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color="#5c4033" roughness={0.8} />
    </mesh>
  )
}

function Wall({ position, rotation, width = 30, height = 4 }: { position: [number, number, number], rotation?: [number, number, number], width?: number, height?: number }) {
  return (
    <mesh position={position} rotation={rotation || [0, 0, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, 0.3]} />
      <meshStandardMaterial color="#d4c4a8" roughness={0.9} />
    </mesh>
  )
}

function Table({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Table top */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.05, 32]} />
        <meshStandardMaterial color="#8b4513" roughness={0.4} />
      </mesh>
      {/* Table leg */}
      <mesh position={[0, 0.375, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.75, 16]} />
        <meshStandardMaterial color="#2d2d2d" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 32]} />
        <meshStandardMaterial color="#2d2d2d" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  )
}

function Chair({ position, rotation = 0 }: { position: [number, number, number], rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Seat */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.4, 0.05, 0.4]} />
        <meshStandardMaterial color="#654321" roughness={0.6} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.7, -0.175]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.05]} />
        <meshStandardMaterial color="#654321" roughness={0.6} />
      </mesh>
      {/* Legs */}
      {[[-0.15, 0.225, 0.15], [0.15, 0.225, 0.15], [-0.15, 0.225, -0.15], [0.15, 0.225, -0.15]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.04, 0.45, 0.04]} />
          <meshStandardMaterial color="#4a3728" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function Counter() {
  return (
    <group position={[0, 0, -12]}>
      {/* Main counter */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[8, 1.1, 1]} />
        <meshStandardMaterial color="#3d2b1f" roughness={0.5} />
      </mesh>
      {/* Counter top */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[8.2, 0.1, 1.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Back shelf */}
      <mesh position={[0, 1.5, -0.8]} castShadow>
        <boxGeometry args={[8, 2, 0.3]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.7} />
      </mesh>
      {/* Coffee machine */}
      <mesh position={[2, 1.5, -0.2]} castShadow>
        <boxGeometry args={[0.8, 0.6, 0.5]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  )
}

function CoffeeCup({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.04, 0.1, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      {/* Coffee inside */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.02, 16]} />
        <meshStandardMaterial color="#3d2314" roughness={0.9} />
      </mesh>
      {/* Handle */}
      <mesh position={[0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.03, 0.008, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
    </group>
  )
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pot */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 16]} />
        <meshStandardMaterial color="#8b4513" roughness={0.8} />
      </mesh>
      {/* Plant */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color="#228b22" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Lamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Cord */}
      <mesh position={[0, 3.5, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 1, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Shade */}
      <mesh position={[0, 3, 0]} castShadow>
        <coneGeometry args={[0.3, 0.4, 16, 1, true]} />
        <meshStandardMaterial color="#d4a574" side={DoubleSide} roughness={0.8} />
      </mesh>
      {/* Bulb glow */}
      <pointLight position={[0, 2.9, 0]} intensity={0.5} distance={5} color="#ffeedd" />
    </group>
  )
}

function CoffeeShopEnvironment() {
  return (
    <group>
      <Floor />
      
      {/* Walls */}
      <Wall position={[0, 2, -15]} />
      <Wall position={[-15, 2, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Wall position={[15, 2, 0]} rotation={[0, Math.PI / 2, 0]} />
      
      {/* Counter area */}
      <Counter />
      
      {/* Tables with chairs */}
      <Table position={[-5, 0, -5]} />
      <Chair position={[-5.8, 0, -5]} rotation={Math.PI / 2} />
      <Chair position={[-4.2, 0, -5]} rotation={-Math.PI / 2} />
      <CoffeeCup position={[-5, 0.8, -5]} />
      
      <Table position={[5, 0, -5]} />
      <Chair position={[5.8, 0, -5]} rotation={Math.PI / 2} />
      <Chair position={[4.2, 0, -5]} rotation={-Math.PI / 2} />
      
      <Table position={[-5, 0, 2]} />
      <Chair position={[-5, 0, 2.8]} rotation={Math.PI} />
      <Chair position={[-5, 0, 1.2]} rotation={0} />
      <CoffeeCup position={[-4.9, 0.8, 2.1]} />
      
      <Table position={[5, 0, 2]} />
      <Chair position={[5, 0, 2.8]} rotation={Math.PI} />
      <Chair position={[5, 0, 1.2]} rotation={0} />
      
      <Table position={[0, 0, -2]} />
      <Chair position={[-0.8, 0, -2]} rotation={Math.PI / 2} />
      <Chair position={[0.8, 0, -2]} rotation={-Math.PI / 2} />
      
      {/* Plants */}
      <Plant position={[-12, 0, -12]} />
      <Plant position={[12, 0, -12]} />
      <Plant position={[-12, 0, 5]} />
      <Plant position={[12, 0, 5]} />
      
      {/* Hanging lamps */}
      <Lamp position={[-5, 0, -5]} />
      <Lamp position={[5, 0, -5]} />
      <Lamp position={[-5, 0, 2]} />
      <Lamp position={[5, 0, 2]} />
      <Lamp position={[0, 0, -2]} />
    </group>
  )
}

// Controllable character component
interface CharacterProps {
  modelUrl: string
  animationUrl?: string
}

function Character({ modelUrl, animationUrl }: CharacterProps) {
  const group = useRef<Group>(null)
  // Ensure URLs are proxied to avoid CORS issues
  const displayUrl = useMemo(() => getProxiedUrl(animationUrl || modelUrl), [animationUrl, modelUrl])
  const { scene, animations } = useGLTF(displayUrl)
  const { actions, mixer } = useAnimations(animations, group)
  const [, getControls] = useKeyboardControls<Controls>()
  
  const velocity = useRef(new Vector3())
  const direction = useRef(new Vector3())
  const targetRotation = useRef(0)
  
  const SPEED = 4
  const ROTATION_SPEED = 10

  // Clone the scene to avoid shared state issues
  const clonedScene = useMemo(() => {
    const clone = scene.clone()
    clone.traverse((node) => {
      if (node instanceof Mesh) {
        node.castShadow = true
        node.receiveShadow = true
        if (node.material instanceof Material) {
          node.material = node.material.clone()
        }
      }
    })
    return clone
  }, [scene])

  // Scale and center the model
  useEffect(() => {
    if (clonedScene) {
      const box = new Box3().setFromObject(clonedScene)
      const size = box.getSize(new Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 1.5 / maxDim
      clonedScene.scale.setScalar(scale)
      
      const center = box.getCenter(new Vector3())
      clonedScene.position.x = -center.x * scale
      clonedScene.position.y = -box.min.y * scale
      clonedScene.position.z = -center.z * scale
    }
  }, [clonedScene])

  // Play animation when moving
  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      const walkAction = Object.values(actions)[0]
      if (walkAction) {
        walkAction.reset().fadeIn(0.3).play()
      }
    }
    return () => mixer?.stopAllAction()
  }, [actions, mixer])

  useFrame((state, delta) => {
    if (!group.current) return

    const { forward, backward, left, right } = getControls()
    const isMoving = forward || backward || left || right

    // Calculate movement direction
    direction.current.set(0, 0, 0)
    if (forward) direction.current.z -= 1
    if (backward) direction.current.z += 1
    if (left) direction.current.x -= 1
    if (right) direction.current.x += 1
    
    if (direction.current.length() > 0) {
      direction.current.normalize()
      targetRotation.current = Math.atan2(direction.current.x, direction.current.z)
    }

    // Smoothly rotate towards movement direction
    if (isMoving) {
      const currentRotation = group.current.rotation.y
      let rotationDiff = targetRotation.current - currentRotation
      
      // Normalize the rotation difference
      while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2
      while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2
      
      group.current.rotation.y += rotationDiff * ROTATION_SPEED * delta
    }

    // Apply movement
    velocity.current.lerp(
      direction.current.multiplyScalar(SPEED),
      isMoving ? 0.1 : 0.05
    )

    group.current.position.x += velocity.current.x * delta
    group.current.position.z += velocity.current.z * delta

    // Boundary constraints
    group.current.position.x = Math.max(-13, Math.min(13, group.current.position.x))
    group.current.position.z = Math.max(-13, Math.min(13, group.current.position.z))

    // Animation speed based on movement
    if (mixer) {
      mixer.timeScale = isMoving ? 1 : 0
    }

    // Camera follows character
    const cameraTarget = new Vector3(
      group.current.position.x,
      group.current.position.y + 2,
      group.current.position.z + 6
    )
    state.camera.position.lerp(cameraTarget, 0.05)
    state.camera.lookAt(
      group.current.position.x,
      group.current.position.y + 1,
      group.current.position.z
    )
  })

  return (
    <group ref={group} position={[0, 0, 5]}>
      <primitive object={clonedScene} />
    </group>
  )
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading scene...</p>
      </div>
    </Html>
  )
}

interface CoffeeShopGameProps {
  modelUrl: string
  animationUrl?: string
}

export function CoffeeShopGame({ modelUrl, animationUrl }: CoffeeShopGameProps) {
  const [error, setError] = useState<Error | null>(null)

  const handleError = useCallback((err: Error) => {
    setError(err)
  }, [])

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
            <h3 className="font-medium text-foreground">Failed to load game</h3>
            <p className="text-sm text-muted-foreground mt-1">Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden">
      <KeyboardControls map={keyboardMap}>
        <SceneErrorBoundary onError={handleError}>
          <Canvas
            shadows
            camera={{ position: [0, 5, 10], fov: 60 }}
            gl={{ antialias: true, alpha: false }}
          >
            <color attach="background" args={["#1a1510"]} />
            <fog attach="fog" args={["#1a1510", 10, 35]} />
            
            <ambientLight intensity={0.3} />
            <directionalLight
              position={[10, 15, 10]}
              intensity={0.8}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-20}
              shadow-camera-right={20}
              shadow-camera-top={20}
              shadow-camera-bottom={-20}
            />
            
            <Suspense fallback={<LoadingFallback />}>
              <CoffeeShopEnvironment />
              <Character modelUrl={modelUrl} animationUrl={animationUrl} />
            </Suspense>
            
            <Environment preset="night" />
          </Canvas>
        </SceneErrorBoundary>
      </KeyboardControls>
      
      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 rounded-lg bg-background/90 px-4 py-3 backdrop-blur-sm">
        <p className="text-xs font-medium text-foreground mb-2">Controls</p>
        <div className="flex gap-1">
          <div className="flex flex-col items-center gap-1">
            <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border">W</kbd>
            <div className="flex gap-1">
              <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border">A</kbd>
              <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border">S</kbd>
              <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border">D</kbd>
            </div>
          </div>
          <span className="text-xs text-muted-foreground self-center ml-2">or Arrow Keys</span>
        </div>
      </div>
    </div>
  )
}
