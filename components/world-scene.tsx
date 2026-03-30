"use client"

import React, { useEffect, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Html, PerspectiveCamera } from "@react-three/drei"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

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

// GLB Model loader component
function GLBModel({ modelUrl }: { modelUrl: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const proxiedUrl = getProxiedUrl(modelUrl)
  const { scene } = useGLTF(proxiedUrl)
  
  useEffect(() => {
    if (!groupRef.current) return
    
    // Clone the scene for this instance
    const cloned = scene.clone(true)
    
    // Clear any existing children
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0])
    }
    
    // Scale and center the model
    const box = new THREE.Box3().setFromObject(cloned)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 1.5 / maxDim
    cloned.scale.setScalar(scale)
    
    // Recalculate bounds after scaling
    const newBox = new THREE.Box3().setFromObject(cloned)
    const center = newBox.getCenter(new THREE.Vector3())
    cloned.position.y = -newBox.min.y
    cloned.position.x = -center.x
    cloned.position.z = -center.z
    
    groupRef.current.add(cloned)
  }, [scene])

  return <group ref={groupRef} />
}

// Player model wrapper - renders GLB or fallback
function PlayerModel({ modelUrl, color }: { modelUrl?: string; color: string }) {
  if (!modelUrl) {
    return <CapsuleAvatar color={color} />
  }
  
  return (
    <ErrorBoundaryModel fallback={<CapsuleAvatar color={color} />}>
      <React.Suspense fallback={<CapsuleAvatar color={color} />}>
        <GLBModel modelUrl={modelUrl} />
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
function LocalPlayerCharacter({ player, positionRef, rotationRef, modelUrl }: { player: Player; positionRef: React.MutableRefObject<{x: number, z: number}>; rotationRef: React.MutableRefObject<number>; modelUrl: string }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.x = positionRef.current.x
      groupRef.current.position.z = positionRef.current.z
      groupRef.current.rotation.y = rotationRef.current
    }
  })

  return (
    <group ref={groupRef} position={[positionRef.current.x, 0, positionRef.current.z]}>
      <PlayerModel modelUrl={modelUrl || player.model_url} color={player.color} />

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
      {/* Lighting - simplified for performance */}
      <ambientLight intensity={1} />
      <directionalLight position={[15, 20, 10]} intensity={0.8} castShadow shadow-mapSize={[512, 512]} />

      {/* Ground - Gray */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>

      {/* Players */}
      {players.map((player) => (
        player.id === localPlayerId ? (
          <LocalPlayerCharacter key={player.id} player={player} positionRef={positionRef} rotationRef={rotationRef} modelUrl={modelUrl} />
        ) : (
          <OtherPlayerCharacter key={player.id} player={player} />
        )
      ))}

      {/* Environment - White sky */}
      <color attach="background" args={["#ffffff"]} />

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
      <Canvas 
        shadows="basic"
        gl={{ 
          antialias: true,
          powerPreference: "default",
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false
        }}
        onCreated={({ gl }) => {
          // Handle context loss gracefully
          const canvas = gl.domElement
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            console.log('[v0] WebGL context lost, will restore')
          })
          canvas.addEventListener('webglcontextrestored', () => {
            console.log('[v0] WebGL context restored')
          })
        }}
      >
        <Scene players={players} localPlayerId={localPlayerId} modelUrl={modelUrl} onPositionChange={onPositionChange} />
      </Canvas>
    </div>
  )
}
