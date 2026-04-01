"use client"

import React, { useEffect, useRef, useState, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Html, PerspectiveCamera, useGLTF, useAnimations } from "@react-three/drei"
import * as THREE from "three"
import { SkeletonUtils } from "three-stdlib"

interface Player {
  id: string
  nickname: string
  model_url?: string
  animation_url?: string
  position_x: number
  position_y: number
  position_z: number
  rotation_y: number
  color: string
}

// Proxy URL helper for external model URLs
function getProxiedUrl(url: string): string {
  if (!url) return url
  if (url.startsWith("/api/proxy-model") || url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url
  }
  return `/api/proxy-model?url=${encodeURIComponent(url)}`
}

// Fallback capsule avatar when no model is available
function CapsuleAvatar({ color }: { color: string }) {
  return (
    <>
      <mesh castShadow position={[0, 0.6, 0]}>
        <capsuleGeometry args={[0.3, 0.8, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.3, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </>
  )
}

// GLB Model loader component with animation support
function GLBModel({ animatedUrl, originalUrl, isMoving }: { animatedUrl: string; originalUrl: string; isMoving?: boolean }) {
  const groupRef = useRef<THREE.Group>(null)

  const proxiedAnimatedUrl = getProxiedUrl(animatedUrl)
  const proxiedOriginalUrl = getProxiedUrl(originalUrl)

  const { scene: animatedScene, animations } = useGLTF(proxiedAnimatedUrl)
  const { scene: originalScene } = useGLTF(proxiedOriginalUrl)
  
  // Clone and scale the scene, memoized per scene change
  const scaledClone = useMemo(() => {
    const cloned = SkeletonUtils.clone(animatedScene)

    // Apply original materials to cloned animated scene
    if (originalScene && proxiedOriginalUrl !== proxiedAnimatedUrl) {
      // The Meshy animation API can alter mesh hierarchies and combine meshes.
      // Typically, models generated through v0/Meshy use a single material atlas.
      // So we extract the first valid material from the original and apply it everywhere.
      let originalMaterial: THREE.MeshStandardMaterial | null = null
      originalScene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          originalMaterial = child.material as THREE.MeshStandardMaterial
        }
      })

      if (originalMaterial) {
        cloned.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = originalMaterial
          }
        })
      }
    }
    
    // Reset transforms completely
    cloned.scale.set(1, 1, 1)
    cloned.position.set(0, 0, 0)
    cloned.rotation.set(0, 0, 0)
    
    // Calculate bounding box based on original scene to maintain consistent size
    // Using original scene because animated bounds can vary drastically
    const box = new THREE.Box3().setFromObject(originalScene || cloned)
    const size = box.getSize(new THREE.Vector3())
    
    // Use the MAXIMUM dimension to normalize all models consistently
    // This ensures both small and large models scale to the same visible size
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const targetSize = 1.5 // Target max dimension in world units
    const scale = targetSize / maxDim
    
    cloned.scale.setScalar(scale)
    
    // Center the model after scaling
    const newBox = new THREE.Box3().setFromObject(cloned)
    const center = newBox.getCenter(new THREE.Vector3())
    cloned.position.y = -newBox.min.y
    cloned.position.x = -center.x
    cloned.position.z = -center.z
    
    return cloned
  }, [animatedScene, originalScene, proxiedAnimatedUrl, proxiedOriginalUrl])
  
  // Bind animations directly to the scaled clone
  const { actions, names } = useAnimations(animations, scaledClone)
  
  // Auto-play the first animation when model loads
  useEffect(() => {
    if (!actions || names.length === 0) return
    
    const animationToPlay = names[0]
    if (animationToPlay && actions[animationToPlay]) {
      const action = actions[animationToPlay]
      action?.reset().fadeIn(0.3).play()
      action!.timeScale = 1
    }
  }, [actions, names])
  
  // Adjust animation speed based on movement
  useFrame(() => {
    if (actions && names.length > 0 && names[0] && actions[names[0]]) {
      const action = actions[names[0]]
      if (action && isMoving !== undefined) {
        action.timeScale = THREE.MathUtils.lerp(action.timeScale, isMoving ? 1.2 : 0.3, 0.1)
      }
    }
  })
  
  // Add scaled clone to group when ready
  useEffect(() => {
    if (!groupRef.current || !scaledClone) return
    
    // Clear existing children
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0])
    }
    
    groupRef.current.add(scaledClone)
    
    return () => {
      // Cleanup on unmount
      if (groupRef.current) {
        while (groupRef.current.children.length > 0) {
          groupRef.current.remove(groupRef.current.children[0])
        }
      }
    }
  }, [scaledClone])

  return <group ref={groupRef} />
}

// Get available animations from a model
export function useModelAnimations(modelUrl: string): string[] {
  const proxiedUrl = getProxiedUrl(modelUrl)
  try {
    const { animations } = useGLTF(proxiedUrl)
    return animations.map(a => a.name)
  } catch {
    return []
  }
}

// Player model wrapper - renders GLB or fallback
function PlayerModel({ animatedUrl, originalUrl, color, isMoving }: { animatedUrl?: string; originalUrl?: string; color: string; isMoving?: boolean }) {
  if (!animatedUrl) {
    return <CapsuleAvatar color={color} />
  }
  
  return (
    <ErrorBoundaryModel fallback={<CapsuleAvatar color={color} />}>
      <React.Suspense fallback={<CapsuleAvatar color={color} />}>
        <GLBModel animatedUrl={animatedUrl} originalUrl={originalUrl || animatedUrl} isMoving={isMoving} />
      </React.Suspense>
    </ErrorBoundaryModel>
  )
}

// Simple error boundary for model loading
class ErrorBoundaryModel extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: any, errorInfo: any) { console.error("Model Error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// Player character component for other players (not local)
function OtherPlayerCharacter({ player }: { player: Player }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (groupRef.current) {
      // Smoothly interpolate to target position
      groupRef.current.position.lerp(
        new THREE.Vector3(player.position_x, player.position_y, player.position_z),
        0.1
      )
      // Smoothly interpolate rotation
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        player.rotation_y,
        0.1
      )
    }
  })

  // Use animation_url if available, otherwise fall back to model_url
  const displayModelUrl = player.animation_url || player.model_url
  const originalModelUrl = player.model_url || displayModelUrl

  return (
    <group ref={groupRef} position={[player.position_x, player.position_y, player.position_z]}>
      <PlayerModel animatedUrl={displayModelUrl} originalUrl={originalModelUrl} color={player.color} />

      {/* Name label */}
      <Html position={[0, 1.8, 0]} center>
        <div className="bg-background/90 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap text-foreground border border-border">
          {player.nickname}
        </div>
      </Html>
    </group>
  )
}

// Local player character that we control
function LocalPlayerCharacter({ player, positionRef, rotationRef, modelUrl, originalModelUrl, isMovingRef }: { player: Player; positionRef: React.MutableRefObject<{x: number, z: number}>; rotationRef: React.MutableRefObject<number>; modelUrl: string; originalModelUrl: string; isMovingRef: React.MutableRefObject<boolean> }) {
  const groupRef = useRef<THREE.Group>(null)
  const [isMoving, setIsMoving] = useState(false)

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.x = positionRef.current.x
      groupRef.current.position.z = positionRef.current.z
      groupRef.current.rotation.y = rotationRef.current
    }
    // Update movement state for animation
    setIsMoving(isMovingRef.current)
  })

  return (
    <group ref={groupRef} position={[positionRef.current.x, 0, positionRef.current.z]}>
      <PlayerModel animatedUrl={modelUrl || player.model_url} originalUrl={originalModelUrl || player.model_url} color={player.color} isMoving={isMoving} />

      {/* Name label */}
      <Html position={[0, 1.8, 0]} center>
        <div className="bg-background/90 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap text-foreground border border-border">
          {player.nickname} (You)
        </div>
      </Html>
    </group>
  )
}

// Tropical palm tree component
function PalmTree({ position }: { position: [number, number, number] }) {
  const trunkHeight = 4
  const frondRadius = 3
  
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh castShadow receiveShadow position={[0, trunkHeight / 2, 0]}>
        <cylinderGeometry args={[0.3, 0.4, trunkHeight, 8]} />
        <meshStandardMaterial color="#8B6F47" />
      </mesh>
      
      {/* Fronds - cluster of geometry */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} castShadow position={[0, trunkHeight, 0]} rotation={[0, (i * Math.PI * 2) / 5, Math.PI / 3]}>
          <coneGeometry args={[frondRadius, 1.5, 8]} />
          <meshStandardMaterial color="#2D5016" />
        </mesh>
      ))}
    </group>
  )
}

// Beach umbrella component
function BeachUmbrella({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pole */}
      <mesh castShadow position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 1.5, 8]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      
      {/* Umbrella canopy */}
      <mesh castShadow position={[0, 1.5, 0]}>
        <coneGeometry args={[1.2, 0.3, 16]} />
        <meshStandardMaterial color="#FF6B6B" />
      </mesh>
    </group>
  )
}

// Rock cluster component
function RockCluster({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} castShadow receiveShadow position={[Math.cos((i * Math.PI * 2) / 3) * 0.5, 0.3, Math.sin((i * Math.PI * 2) / 3) * 0.5]}>
          <dodecahedronGeometry args={[0.4]} />
          <meshStandardMaterial color="#A9A9A9" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// Wooden dock component
function Dock({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main platform */}
      <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[2, 0.2, 6]} />
        <meshStandardMaterial color="#CD853F" />
      </mesh>
      
      {/* Support posts */}
      {[[-0.8, 0], [0.8, 0], [-0.8, 4], [0.8, 4]].map((pos, i) => (
        <mesh key={i} castShadow receiveShadow position={[pos[0], -0.5, pos[1]]}>
          <cylinderGeometry args={[0.15, 0.15, 1, 8]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      ))}
    </group>
  )
}

// Island environment component
function IslandEnvironment() {
  return (
    <group>
      {/* Sandy beach base */}
      <mesh castShadow receiveShadow position={[0, -0.5, 0]} scale={[8, 0.5, 8]}>
        <cylinderGeometry args={[1, 1, 1, 32]} />
        <meshStandardMaterial color="#F4A460" />
      </mesh>
      
      {/* Grassy center */}
      <mesh castShadow receiveShadow position={[0, 0.01, 0]} scale={[4, 0.1, 4]}>
        <cylinderGeometry args={[1, 1, 1, 32]} />
        <meshStandardMaterial color="#7CB342" />
      </mesh>
      
      {/* Lagoon on the side */}
      <mesh receiveShadow position={[-7, -0.3, 0]} scale={[2.5, 0.3, 3]}>
        <cylinderGeometry args={[1, 1, 1, 32]} />
        <meshStandardMaterial color="#4DA6FF" transparent opacity={0.7} />
      </mesh>
      
      {/* Palm trees scattered around */}
      <PalmTree position={[-3, 0, -3]} />
      <PalmTree position={[3, 0, -4]} />
      <PalmTree position={[4, 0, 2]} />
      <PalmTree position={[-4, 0, 3]} />
      <PalmTree position={[2, 0, 3.5]} />
      
      {/* Beach umbrellas */}
      <BeachUmbrella position={[-2, 0, -2]} />
      <BeachUmbrella position={[1.5, 0, -3]} />
      <BeachUmbrella position={[3, 0, 1]} />
      
      {/* Rock clusters */}
      <RockCluster position={[-5, 0, -1]} />
      <RockCluster position={[5, 0, -2]} />
      <RockCluster position={[0, 0, -5]} />
      
      {/* Wooden dock extending to water */}
      <Dock position={[-7.5, 0, 0]} />
    </group>
  )
}

// Main scene
function Scene({ players, localPlayerId, modelUrl, originalModelUrl, onPositionChange }: { players: Player[]; localPlayerId: string | null; modelUrl: string; originalModelUrl: string; onPositionChange: (x: number, z: number, rotation: number) => void }) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const localPlayer = players.find((p) => p.id === localPlayerId)
  const keysPressed = useRef<{ [key: string]: boolean }>({})
  const velocityRef = useRef({ x: 0, z: 0 })
  const positionRef = useRef({ x: localPlayer?.position_x || 0, z: localPlayer?.position_z || 0 })
  const rotationRef = useRef(localPlayer?.rotation_y || 0)
  const isMovingRef = useRef(false)

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tagName = target.tagName.toLowerCase()
      return tagName === "input" || tagName === "textarea" || target.isContentEditable
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        keysPressed.current[key] = true
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        keysPressed.current[key] = false
        e.preventDefault()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  useFrame(() => {
    if (!localPlayer) return

    // Movement speed
    const speed = 0.15
    const rotationSpeed = 0.05

    // Handle rotation (Left/Right arrow)
    if (keysPressed.current["arrowleft"]) {
      rotationRef.current += rotationSpeed
    }
    if (keysPressed.current["arrowright"]) {
      rotationRef.current -= rotationSpeed
    }

    // Handle movement (Up/Down arrow)
    const forward = (keysPressed.current["arrowup"] ? 1 : 0) + (keysPressed.current["arrowdown"] ? -1 : 0)
    const isRotating = keysPressed.current["arrowleft"] || keysPressed.current["arrowright"]

    // Track if player is moving for animation
    isMovingRef.current = forward !== 0 || isRotating

    if (forward !== 0) {
      const moveX = Math.sin(rotationRef.current) * speed * forward
      const moveZ = Math.cos(rotationRef.current) * speed * forward
      positionRef.current.x += moveX
      positionRef.current.z += moveZ
    }

    // Clamp to world bounds
    positionRef.current.x = Math.max(-50, Math.min(50, positionRef.current.x))
    positionRef.current.z = Math.max(-50, Math.min(50, positionRef.current.z))

    // Update camera to follow player
    if (cameraRef.current) {
      const camDistance = 5
      const camHeight = 2
      const camX = positionRef.current.x - Math.sin(rotationRef.current) * camDistance
      const camZ = positionRef.current.z - Math.cos(rotationRef.current) * camDistance
      cameraRef.current.position.lerp(new THREE.Vector3(camX, camHeight, camZ), 0.1)
      cameraRef.current.lookAt(positionRef.current.x, 1, positionRef.current.z)
    }

    // Send position update to server
    onPositionChange(positionRef.current.x, positionRef.current.z, rotationRef.current)
  })

  return (
    <>
      {/* Warm tropical lighting */}
      <ambientLight intensity={0.7} color="#FFF8DC" />
      <directionalLight position={[20, 25, 15]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} color="#FFFACD" />
      <pointLight position={[-15, 12, -15]} intensity={0.4} color="#FFE4B5" />
      <fogExp2 attach="fog" args={["#E0F6FF", 0.02]} />

      {/* Ocean water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -1, 0]}>
        <circleGeometry args={[35, 64]} />
        <meshStandardMaterial color="#1E90FF" metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Sandy ground/beach area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0.01, 0]}>
        <circleGeometry args={[15, 32]} />
        <meshStandardMaterial color="#EDC9AF" />
      </mesh>

      {/* Tropical island environment */}
      <IslandEnvironment />

      {/* Players */}
      {players.map((player) => (
        player.id === localPlayerId ? (
          <LocalPlayerCharacter key={player.id} player={player} positionRef={positionRef} rotationRef={rotationRef} modelUrl={modelUrl} originalModelUrl={originalModelUrl} isMovingRef={isMovingRef} />
        ) : (
          <OtherPlayerCharacter key={player.id} player={player} />
        )
      ))}

      {/* Bright tropical sky */}
      <color attach="background" args={["#87CEEB"]} />

      {/* Camera */}
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 2, 5]} fov={50} />
    </>
  )
}

interface WorldSceneProps {
  players: Player[]
  localPlayerId: string | null
  modelUrl: string
  originalModelUrl: string
  onPositionChange: (x: number, z: number, rotation: number) => void
}

export default function WorldScene({ players, localPlayerId, modelUrl, originalModelUrl, onPositionChange }: WorldSceneProps) {
  return (
    <div className="w-full h-screen">
      <Canvas shadows>
        <Scene players={players} localPlayerId={localPlayerId} modelUrl={modelUrl} originalModelUrl={originalModelUrl} onPositionChange={onPositionChange} />
      </Canvas>
    </div>
  )
}
