"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment, PerspectiveCamera } from "@react-three/drei"
import { createClient } from "@supabase/supabase-js"
import * as THREE from "three"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, LogOut, Users } from "lucide-react"

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Player representation in 3D
function PlayerAvatar({ player, isLocalPlayer }: { player: any; isLocalPlayer: boolean }) {
  const meshRef = useRef<THREE.Group>(null)
  const nameLabel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.set(player.position_x, player.position_y, player.position_z)
      meshRef.current.rotation.y = player.rotation_y
    }
  }, [player])

  return (
    <group ref={meshRef}>
      {/* Body */}
      <mesh castShadow>
        <capsuleGeometry args={[0.3, 1.2, 8, 16]} />
        <meshStandardMaterial color={player.color || "#3b82f6"} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial color={player.color || "#3b82f6"} />
      </mesh>

      {/* Name label */}
      <mesh position={[0, 1.5, 0]}>
        <billboardGeometry args={[1, 0.4, 1]} />
        <meshBasicMaterial transparent>
          <canvasTexture
            attach="map"
            args={[createNameCanvas(player.nickname, isLocalPlayer)]}
          />
        </meshBasicMaterial>
      </mesh>
    </group>
  )
}

// Create canvas texture for name labels
function createNameCanvas(nickname: string, isLocal: boolean) {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
  ctx.fillRect(0, 0, 512, 128)
  ctx.fillStyle = isLocal ? "#10b981" : "#ffffff"
  ctx.font = "bold 48px Arial"
  ctx.textAlign = "center"
  ctx.fillText(nickname, 256, 80)
  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

// 3D World Scene
function WorldScene({ players, localPlayerId }: { players: any[]; localPlayerId: string }) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const localPlayer = players.find(p => p.id === localPlayerId)

  useEffect(() => {
    if (cameraRef.current && localPlayer) {
      // Camera follows local player
      cameraRef.current.position.set(
        localPlayer.position_x,
        localPlayer.position_y + 1.5,
        localPlayer.position_z + 3
      )
    }
  }, [localPlayer])

  return (
    <Canvas shadows>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 2, 5]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 10]} intensity={1} castShadow />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>

      {/* Players */}
      {players.map(player => (
        <PlayerAvatar key={player.id} player={player} isLocalPlayer={player.id === localPlayerId} />
      ))}

      <Environment preset="city" />
      <OrbitControls enabled={false} />
    </Canvas>
  )
}

export default function WorldPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [localPlayer, setLocalPlayer] = useState<any>(null)
  const [nickname, setNickname] = useState("")
  const [joined, setJoined] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState("")
  const keysPressed = useRef<Record<string, boolean>>({})
  const updateInterval = useRef<NodeJS.Timeout>()

  // Join world
  const handleJoinWorld = useCallback(async () => {
    if (!nickname.trim()) return

    try {
      const { data, error } = await supabase
        .from("players")
        .insert([
          {
            nickname,
            position_x: Math.random() * 10 - 5,
            position_y: 0,
            position_z: Math.random() * 10 - 5,
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
        .eq("id", data[0].id)
        .single()

      setPlayers([playersData])
    } catch (err) {
      console.error("Failed to join world:", err)
    }
  }, [nickname])

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
    const moveSpeed = 0.1
    updateInterval.current = setInterval(async () => {
      let moved = false
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
        moved = true
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
          <p className="text-muted-foreground mb-6">Create your avatar and join the multiplayer world</p>
          
          <Input
            placeholder="Enter your nickname"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleJoinWorld()}
            className="mb-4"
            maxLength={20}
          />
          
          <Button onClick={handleJoinWorld} className="w-full" disabled={!nickname.trim()}>
            <Users className="h-4 w-4 mr-2" />
            Join World
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen flex flex-col bg-background">
      {/* 3D World */}
      <div className="flex-1 relative">
        <WorldScene players={players} localPlayerId={localPlayer?.id} />
        
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
