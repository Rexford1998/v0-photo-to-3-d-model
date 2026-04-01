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

const BEACH_ASSET_URLS = {
  palmTree: "/api/beach-assets/palm-tree",
  rock: "/api/beach-assets/rock",
  rockyPondOasis: "/api/beach-assets/rocky-pond-oasis",
} as const

// Proxy URL helper for external model URLs
function getProxiedUrl(url: string): string {
  if (!url) return url
  
  // Blob URLs and data URLs don't need proxying
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    return url
  }
  
  // Already a proxy URL - just convert to absolute
  if (url.startsWith("/api/proxy-model")) {
    return `${window.location.origin}${url}`
  }
  
  // Local API routes - convert to absolute
  if (url.startsWith("/api/")) {
    return `${window.location.origin}${url}`
  }
  
  // Local relative URLs - convert to absolute
  if (url.startsWith("/")) {
    return `${window.location.origin}${url}`
  }
  
  // External URLs need to be proxied through our API
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

function StaticBeachProp({
  url,
  position,
  rotation = [0, 0, 0],
  targetSize,
  verticalOffset = 0,
}: {
  url: string
  position: [number, number, number]
  rotation?: [number, number, number]
  targetSize: number
  verticalOffset?: number
}) {
  const { scene } = useGLTF(url)

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true)

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    cloned.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(cloned)
    const size = box.getSize(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z) || 1
    const scale = targetSize / maxDimension

    cloned.scale.setScalar(scale)
    cloned.updateMatrixWorld(true)

    const scaledBox = new THREE.Box3().setFromObject(cloned)
    const center = scaledBox.getCenter(new THREE.Vector3())

    cloned.position.x = -center.x
    cloned.position.y = -scaledBox.min.y + verticalOffset
    cloned.position.z = -center.z
    cloned.updateMatrixWorld(true)

    return cloned
  }, [scene, targetSize, verticalOffset])

  return (
    <group position={position} rotation={rotation}>
      <primitive object={clonedScene} dispose={null} />
    </group>
  )
}

function BeachScenery() {
  return (
    <>
      <StaticBeachProp
        url={BEACH_ASSET_URLS.rockyPondOasis}
        position={[-7.5, -0.45, -0.2]}
        rotation={[0, Math.PI / 2.1, 0]}
        targetSize={6.8}
        verticalOffset={-0.18}
      />

      <StaticBeachProp
        url={BEACH_ASSET_URLS.palmTree}
        position={[-3.4, 0, -3.2]}
        rotation={[0, Math.PI * 0.08, 0]}
        targetSize={5.2}
      />
      <StaticBeachProp
        url={BEACH_ASSET_URLS.palmTree}
        position={[3.1, 0, -4.1]}
        rotation={[0, -Math.PI * 0.16, 0]}
        targetSize={5.8}
      />
      <StaticBeachProp
        url={BEACH_ASSET_URLS.palmTree}
        position={[4.2, 0, 2.1]}
        rotation={[0, Math.PI * 0.32, 0]}
        targetSize={5.4}
      />
      <StaticBeachProp
        url={BEACH_ASSET_URLS.palmTree}
        position={[-4.3, 0, 3.4]}
        rotation={[0, -Math.PI * 0.28, 0]}
        targetSize={5.5}
      />

      <StaticBeachProp
        url={BEACH_ASSET_URLS.rock}
        position={[-5.1, 0, -1.4]}
        rotation={[0, Math.PI * 0.17, 0]}
        targetSize={1.7}
        verticalOffset={-0.08}
      />
      <StaticBeachProp
        url={BEACH_ASSET_URLS.rock}
        position={[5.2, 0, -2.2]}
        rotation={[0, -Math.PI * 0.22, 0]}
        targetSize={1.45}
        verticalOffset={-0.08}
      />
      <StaticBeachProp
        url={BEACH_ASSET_URLS.rock}
        position={[0.4, 0, -5.2]}
        rotation={[0, Math.PI * 0.41, 0]}
        targetSize={1.6}
        verticalOffset={-0.08}
      />
      <StaticBeachProp
        url={BEACH_ASSET_URLS.rock}
        position={[2.6, 0, 4.6]}
        rotation={[0, -Math.PI * 0.37, 0]}
        targetSize={1.3}
        verticalOffset={-0.08}
      />
    </>
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

      <ErrorBoundaryModel fallback={null}>
        <React.Suspense fallback={null}>
          <BeachScenery />
        </React.Suspense>
      </ErrorBoundaryModel>
    </group>
  )
}

// Reusable bot character component
function RandomWalkingBot({ modelUrl, name, startPosition }: { modelUrl: string; name: string; startPosition: { x: number; z: number } }) {
  const groupRef = useRef<THREE.Group>(null)
  const botStateRef = useRef({
    position: { x: startPosition.x, z: startPosition.z },
    rotation: 0,
    targetPosition: { x: startPosition.x + 2, z: startPosition.z + 2 },
    targetRotation: 0,
    moveTimer: 0,
  })
  const [isMoving, setIsMoving] = useState(false)

  // Initialize with a random direction
  useEffect(() => {
    const randomAngle = Math.random() * Math.PI * 2
    const distance = 3 + Math.random() * 5
    botStateRef.current.targetPosition = {
      x: startPosition.x + Math.cos(randomAngle) * distance,
      z: startPosition.z + Math.sin(randomAngle) * distance,
    }
  }, [startPosition])

  useFrame(() => {
    if (!groupRef.current) return

    const bot = botStateRef.current
    const speed = 0.08
    const rotationSpeed = 0.03

    // Distance to target
    const dx = bot.targetPosition.x - bot.position.x
    const dz = bot.targetPosition.z - bot.position.z
    const distance = Math.sqrt(dx * dx + dz * dz)

    // If close to target, pick a new random target
    if (distance < 0.5) {
      bot.moveTimer++
      if (bot.moveTimer > 120) {
        // Every ~2 seconds, pick new target in completely random direction
        const randomAngle = Math.random() * Math.PI * 2
        const randomDistance = 3 + Math.random() * 5
        bot.targetPosition = {
          x: bot.position.x + Math.cos(randomAngle) * randomDistance,
          z: bot.position.z + Math.sin(randomAngle) * randomDistance,
        }
        bot.moveTimer = 0
      }
      setIsMoving(false)
    } else {
      // Move towards target
      const targetAngle = Math.atan2(dz, dx)
      
      // Normalize rotation difference
      let rotDiff = targetAngle - bot.targetRotation
      if (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      if (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      
      bot.targetRotation += rotDiff * 0.1
      bot.rotation = THREE.MathUtils.lerp(bot.rotation, bot.targetRotation, rotationSpeed)

      // Move forward
      bot.position.x += Math.cos(bot.rotation) * speed
      bot.position.z += Math.sin(bot.rotation) * speed
      bot.moveTimer = 0
      setIsMoving(true)
    }

    // Clamp to island bounds
    const islandRadius = 6
    const distFromCenter = Math.sqrt(bot.position.x ** 2 + bot.position.z ** 2)
    if (distFromCenter > islandRadius) {
      const angle = Math.atan2(bot.position.z, bot.position.x)
      bot.position.x = Math.cos(angle) * islandRadius
      bot.position.z = Math.sin(angle) * islandRadius
    }

    // Update group transform
    groupRef.current.position.x = bot.position.x
    groupRef.current.position.z = bot.position.z
    groupRef.current.rotation.y = bot.rotation
  })

  const colors = ["#FF69B4", "#FF6B9D", "#FF69B4", "#FFB6C1"]
  const color = colors[Math.floor(Math.random() * colors.length)]

  return (
    <group ref={groupRef} position={[startPosition.x, 0, startPosition.z]}>
      {/* Bot model with error boundary */}
      <ErrorBoundaryModel fallback={<CapsuleAvatar color={color} />}>
        <React.Suspense fallback={<CapsuleAvatar color={color} />}>
          <GLBModel animatedUrl={modelUrl} originalUrl={modelUrl} isMoving={isMoving} />
        </React.Suspense>
      </ErrorBoundaryModel>

      {/* Name label */}
      <Html position={[0, 1.8, 0]} center>
        <div className="bg-background/90 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap text-foreground border border-border">
          {name}
        </div>
      </Html>
    </group>
  )
}

// Bot character that walks around randomly
function BotCharacter() {
  const botModels = [
    {
      url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Meshy_AI_Very_cute_girl_in_jea_biped_Animation_Running_withSkin-20UTwwBgiVuRPzwbV9R8ne6nVeyf9D.glb",
      name: "Bot - Running",
    },
    {
      url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Meshy_AI_T_Pose_Hoodie_Girl_biped_Animation_Walking_withSkin-W3w8uRp9B0d3AuwHYKBAQ3utQhKzVe.glb",
      name: "Hoodie Bot",
    },
    {
      url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Meshy_AI_Very_cute_girl_in_jea_biped_Animation_Walking_withSkin-wRv3zD9dbQut9hPXPrfuKmlXl0oVqY.glb",
      name: "Jeans Bot",
    },
    {
      url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Meshy_AI_t_pose_realistic_summ_biped_Animation_Walking_withSkin-RlLhvfw69OhuJf2MULEAhMVKIAohri.glb",
      name: "Summer Bot",
    },
  ]

  // Spawn bots at different positions around the island
  const botPositions = [
    { x: -3, z: 2 },
    { x: 3, z: -2 },
    { x: 1, z: 3 },
    { x: -2, z: -3 },
  ]

  return (
    <group>
      {botModels.map((bot, index) => (
        <RandomWalkingBot
          key={index}
          modelUrl={bot.url}
          name={bot.name}
          startPosition={botPositions[index % botPositions.length]}
        />
      ))}
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

      {/* Bot character */}
      <BotCharacter />

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

useGLTF.preload(BEACH_ASSET_URLS.palmTree)
useGLTF.preload(BEACH_ASSET_URLS.rock)
useGLTF.preload(BEACH_ASSET_URLS.rockyPondOasis)
