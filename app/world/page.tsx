"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment, PerspectiveCamera, useGLTF } from "@react-three/drei"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import * as THREE from "three"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, LogOut, Users, ArrowLeft } from "lucide-react"
import Link from "next/link"

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 3D Avatar component that loads GLB model
function AvatarModel({ modelUrl, position }: { modelUrl: string; position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null)
  const proxyUrl = `/api/model-proxy?url=${encodeURIComponent(modelUrl)}`
  
  try {
    const { scene } = useGLTF(proxyUrl)
    
    useEffect(() => {
      if (groupRef.current) {
        groupRef.current.position.set(position[0], position[1], position[2])
      }
    }, [position])

    return (
      <group ref={groupRef}>
        <primitive object={scene.clone()} scale={[0.5, 0.5, 0.5]} />
      </group>
    )
  } catch {
    // Fallback to capsule if model fails to load
    return (
      <group ref={groupRef} position={position}>
        <mesh>
          <capsuleGeometry args={[0.3, 1.2, 8, 16]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[0.25, 32, 32]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </group>
    )
  }
}

// Player representation in 3D with name label
function PlayerAvatar({ player, isLocalPlayer, modelUrl }: { player: any; isLocalPlayer: boolean; modelUrl?: string }) {
  const meshRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.set(player.position_x, player.position_y, player.position_z)
      meshRef.current.rotation.y = player.rotation_y
    }
  }, [player])

  return (
    <group ref={meshRef}>
      {modelUrl ? (
        <AvatarModel modelUrl={modelUrl} position={[0, 0, 0]} />
      ) : (
        <>
          {/* Fallback body */}
          <mesh castShadow>
            <capsuleGeometry args={[0.3, 1.2, 8, 16]} />
            <meshStandardMaterial color={player.color || "#3b82f6"} />
          </mesh>
          {/* Fallback head */}
          <mesh position={[0, 0.8, 0]} castShadow>
            <sphereGeometry args={[0.25, 32, 32]} />
            <meshStandardMaterial color={player.color || "#3b82f6"} />
          </mesh>
        </>
      )}

      {/* Name label */}
      <mesh position={[0, 1.8, 0]}>
        <planeGeometry args={[1.5, 0.3]} />
        <meshBasicMaterial 
          map={createNameTexture(player.nickname, isLocalPlayer)}
          transparent
        />
      </mesh>
    </group>
  )
}

// Create canvas texture for name labels
function createNameTexture(nickname: string, isLocal: boolean) {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = isLocal ? "rgba(16, 185, 129, 0.9)" : "rgba(0, 0, 0, 0.7)"
  ctx.fillRect(0, 0, 256, 64)
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 32px Arial"
  ctx.textAlign = "center"
  ctx.fillText(nickname, 128, 48)
  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

// 3D World Scene
function WorldScene({ players, localPlayerId, modelUrl }: { players: any[]; localPlayerId: string; modelUrl: string }) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const localPlayer = players.find(p => p.id === localPlayerId)

  useEffect(() => {
    if (cameraRef.current && localPlayer) {
      cameraRef.current.position.set(
        localPlayer.position_x,
        localPlayer.position_y + 2,
        localPlayer.position_z + 4
      )
      cameraRef.current.lookAt(localPlayer.position_x, localPlayer.position_y + 1, localPlayer.position_z)
    }
  }, [localPlayer])

  return (
    <Canvas shadows>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 2, 5]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 10]} intensity={1} castShadow />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>

      {/* Grid */}
      <gridHelper args={[200, 40]} position={[0, 0.01, 0]} />

      {/* Players */}
      {players.map(player => (
        <PlayerAvatar 
          key={player.id} 
          player={player} 
          isLocalPlayer={player.id === localPlayerId}
          modelUrl={player.model_url || modelUrl}
        />
      ))}

      <Environment preset="city" />
    </Canvas>
  )
}

export default function WorldPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const modelUrl = searchParams.get("modelUrl")
  
  const [players, setPlayers] = useState<any[]>([])
  const [localPlayer, setLocalPlayer] = useState<any>(null)
  const [nickname, setNickname] = useState("")
  const [joined, setJoined] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState("")
  const keysPressed = useRef<Record<string, boolean>>({})
  const updateInterval = useRef<NodeJS.Timeout>()

  // Check if model URL exists
  if (!modelUrl) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-background to-secondary/50 flex items-center justify-center">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <h1 className="text-3xl font-bold mb-2">Generate Avatar First</h1>
          <p className="text-muted-foreground mb-6">
            You need to generate a 3D avatar before joining the multiplayer world.
          </p>
          <Link href="/avatar-builder">
            <Button className="w-full">
              Go to Avatar Builder
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Join world
  const handleJoinWorld = useCallback(async () => {
    if (!nickname.trim()) return

    try {
      const { data, error } = await supabase
        .from("players")
        .insert([
          {
            nickname,
            model_url: modelUrl,
            position_x: Math.random() * 20 - 10,
            position_y: 0,
            position_z: Math.random() * 20 - 10,
            rotation_y: 0,
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
          }
        ])
        .select()

      if (error) throw error
      setLocalPlayer(data[0])
      setJoined(true)

      // Subscribe to player updates
      const channel = supabase
        .channel("players-channel")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "players" },
          payload => {
            if (payload.eventType === "DELETE") {
              setPlayers(prev => prev.filter(p => p.id !== payload.old.id))
            } else {
              setPlayers(prev => {
                const existing = prev.findIndex(p => p.id === payload.new.id)
                if (existing >= 0) {
                  const updated = [...prev]
                  updated[existing] = payload.new
                  return updated
                }
                return [...prev, payload.new]
              })
            }
          }
        )
        .subscribe()

      // Subscribe to chat
      supabase
        .channel("chat-channel")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          payload => {
            setChatMessages(prev => [...prev, payload.new])
          }
        )
        .subscribe()

      // Load initial players
      const { data: playersData } = await supabase
        .from("players")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20)

      setPlayers(playersData || [])
    } catch (err) {
      console.error("Failed to join world:", err)
    }
  }, [nickname, modelUrl])

  // Handle keyboard movement
  useEffect(() => {
    if (!localPlayer) return

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    // Update position based on keys
    const moveSpeed = 0.15
    updateInterval.current = setInterval(async () => {
      let newX = localPlayer.position_x
      let newZ = localPlayer.position_z
      let newRotation = localPlayer.rotation_y

      if (keysPressed.current["w"]) newZ -= moveSpeed
      if (keysPressed.current["s"]) newZ += moveSpeed
      if (keysPressed.current["a"]) {
        newX -= moveSpeed
        newRotation = Math.PI / 2
      }
      if (keysPressed.current["d"]) {
        newX += moveSpeed
        newRotation = -Math.PI / 2
      }

      if (newX !== localPlayer.position_x || newZ !== localPlayer.position_z) {
        await supabase
          .from("players")
          .update({
            position_x: newX,
            position_z: newZ,
            rotation_y: newRotation,
            last_seen: new Date()
          })
          .eq("id", localPlayer.id)

        setLocalPlayer(prev => ({ ...prev, position_x: newX, position_z: newZ, rotation_y: newRotation }))
      }
    }, 50)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      if (updateInterval.current) clearInterval(updateInterval.current)
    }
  }, [localPlayer])

  // Send chat message
  const handleSendChat = async () => {
    if (!chatInput.trim() || !localPlayer) return

    try {
      await supabase.from("chat_messages").insert([
        {
          player_id: localPlayer.id,
          username: localPlayer.nickname,
          message: chatInput
        }
      ])
      setChatInput("")
    } catch (err) {
      console.error("Failed to send message:", err)
    }
  }

  // Leave world
  const handleLeaveWorld = async () => {
    if (localPlayer) {
      await supabase.from("players").delete().eq("id", localPlayer.id)
    }
    setJoined(false)
    setLocalPlayer(null)
    setChatMessages([])
  }

  if (!joined) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-background to-secondary/50 flex items-center justify-center">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <h1 className="text-3xl font-bold mb-2">Enter World</h1>
          <p className="text-muted-foreground mb-6">Join the multiplayer world with your generated avatar</p>
          
          <Input
            placeholder="Enter your nickname"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleJoinWorld()}
            className="mb-4"
            maxLength={20}
            autoFocus
          />
          
          <Button onClick={handleJoinWorld} className="w-full mb-2" disabled={!nickname.trim()}>
            <Users className="h-4 w-4 mr-2" />
            Join World
          </Button>
          
          <Link href="/avatar-builder">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Avatar Builder
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen flex flex-col bg-background">
      {/* 3D World */}
      <div className="flex-1 relative">
        <WorldScene players={players} localPlayerId={localPlayer?.id} modelUrl={modelUrl} />
        
        {/* UI Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
          <div className="bg-background/80 backdrop-blur border border-border rounded-lg p-3 pointer-events-auto">
            <p className="text-sm font-medium">{nickname}</p>
            <p className="text-xs text-muted-foreground">WASD to move</p>
          </div>
          
          <div className="bg-background/80 backdrop-blur border border-border rounded-lg p-3 pointer-events-auto">
            <p className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              {players.length} online
            </p>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeaveWorld}
            className="pointer-events-auto"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Leave
          </Button>
        </div>
      </div>

      {/* Chat Panel */}
      <div className="bg-card border-t border-border p-4 flex flex-col gap-3 h-32">
        <div className="flex-1 overflow-y-auto space-y-2 text-sm">
          {chatMessages.slice(-5).map((msg, i) => (
            <div key={i} className="text-foreground">
              <span className="font-medium text-primary">{msg.username || "Anonymous"}:</span>
              <span className="ml-2 text-muted-foreground">{msg.message}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSendChat()}
            className="flex-1"
          />
          <Button
            onClick={handleSendChat}
            size="sm"
            className="px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
