"use client"

import React, { useEffect, useRef, useState, useMemo } from "react"
import { Canvas, useFrame, useGraph } from "@react-three/fiber"
import { Html, PerspectiveCamera, useGLTF, useAnimations } from "@react-three/drei"
import * as THREE from "three"
import { SkeletonUtils } from "three-stdlib"

interface Player {
  id: string
  nickname: string
  model_url?: string
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
function GLBModel({ modelUrl, isMoving }: { modelUrl: string; isMoving?: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const proxiedUrl = getProxiedUrl(modelUrl)
  const { scene, animations } = useGLTF(proxiedUrl)
  
  // Clone and scale the scene, memoized per scene change
  const scaledClone = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene)
    
    // Reset transforms
    cloned.scale.set(1, 1, 1)
    cloned.position.set(0, 0, 0)
    cloned.rotation.set(0, 0, 0)
    
    // Calculate scale based on HEIGHT - target 1.5 units for humanoids
    const box = new THREE.Box3().setFromObject(cloned)
    const size = box.getSize(new THREE.Vector3())
    const height = size.y || 1
    const targetHeight = 1.5
    const scale = targetHeight / height
    cloned.scale.setScalar(scale)
    
    // Center the model
    const newBox = new THREE.Box3().setFromObject(cloned)
    const center = newBox.getCenter(new THREE.Vector3())
    cloned.position.y = -newBox.min.y
    cloned.position.x = -center.x
    cloned.position.z = -center.z
    
    return cloned
  }, [scene])
  
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
function PlayerModel({ modelUrl, color, isMoving }: { modelUrl?: string; color: string; isMoving?: boolean }) {
  if (!modelUrl) {
    return <CapsuleAvatar color={color} />
  }
  
  return (
    <ErrorBoundaryModel fallback={<CapsuleAvatar color={color} />}>
      <React.Suspense fallback={<CapsuleAvatar color={color} />}>
        <GLBModel modelUrl={modelUrl} isMoving={isMoving} />
      </React.Suspense>
    </ErrorBoundaryModel>
  )
}

// Simple error boundary for model loading
class ErrorBoundaryModel extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  
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

  return (
    <group ref={groupRef} position={[player.position_x, player.position_y, player.position_z]}>
      <PlayerModel modelUrl={player.model_url} color={player.color} />

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
function LocalPlayerCharacter({ player, positionRef, rotationRef, modelUrl, isMovingRef }: { player: Player; positionRef: React.MutableRefObject<{x: number, z: number}>; rotationRef: React.MutableRefObject<number>; modelUrl: string; isMovingRef: React.MutableRefObject<boolean> }) {
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
      <PlayerModel modelUrl={modelUrl || player.model_url} color={player.color} isMoving={isMoving} />

      {/* Name label */}
      <Html position={[0, 1.8, 0]} center>
        <div className="bg-background/90 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap text-foreground border border-border">
          {player.nickname} (You)
        </div>
      </Html>
    </group>
  )
}

// Main scene
function Scene({ players, localPlayerId, modelUrl, onPositionChange }: { players: Player[]; localPlayerId: string | null; modelUrl: string; onPositionChange: (x: number, z: number, rotation: number) => void }) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const localPlayer = players.find((p) => p.id === localPlayerId)
  const keysPressed = useRef<{ [key: string]: boolean }>({})
  const velocityRef = useRef({ x: 0, z: 0 })
  const positionRef = useRef({ x: localPlayer?.position_x || 0, z: localPlayer?.position_z || 0 })
  const rotationRef = useRef(localPlayer?.rotation_y || 0)
  const isMovingRef = useRef(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        keysPressed.current[key] = true
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
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

    // Handle rotation (A/D or Left/Right arrow)
    if (keysPressed.current["a"] || keysPressed.current["arrowleft"]) {
      rotationRef.current += rotationSpeed
    }
    if (keysPressed.current["d"] || keysPressed.current["arrowright"]) {
      rotationRef.current -= rotationSpeed
    }

    // Handle movement (W/S or Up/Down arrow)
    const forward = (keysPressed.current["w"] || keysPressed.current["arrowup"] ? 1 : 0) + (keysPressed.current["s"] || keysPressed.current["arrowdown"] ? -1 : 0)
    const isRotating = keysPressed.current["a"] || keysPressed.current["arrowleft"] || keysPressed.current["d"] || keysPressed.current["arrowright"]

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
      {/* Lighting */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[15, 20, 10]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-10, 10, -10]} intensity={0.5} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>

      {/* Players */}
      {players.map((player) => (
        player.id === localPlayerId ? (
          <LocalPlayerCharacter key={player.id} player={player} positionRef={positionRef} rotationRef={rotationRef} modelUrl={modelUrl} isMovingRef={isMovingRef} />
        ) : (
          <OtherPlayerCharacter key={player.id} player={player} />
        )
      ))}

      {/* Environment */}
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
  onPositionChange: (x: number, z: number, rotation: number) => void
}

export default function WorldScene({ players, localPlayerId, modelUrl, onPositionChange }: WorldSceneProps) {
  return (
    <div className="w-full h-screen">
      <Canvas shadows>
        <Scene players={players} localPlayerId={localPlayerId} modelUrl={modelUrl} onPositionChange={onPositionChange} />
      </Canvas>
    </div>
  )
}
