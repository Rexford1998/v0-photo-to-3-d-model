"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment, PerspectiveCamera } from "@react-three/drei"
import * as THREE from "three"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, LogOut, Users, ArrowLeft } from "lucide-react"
import { useMultiplayerWorld } from "@/hooks/useMultiplayerWorld"

// Player 3D representation
function PlayerAvatar({ player, isLocalPlayer }: { player: any; isLocalPlayer: boolean }) {
  const meshRef = useRef<THREE.Group>(null)

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
      <mesh position={[0, 1.8, 0]}>
        <planeGeometry args={[1, 0.25]} />
        <meshBasicMaterial color="white" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// World scene
function WorldScene({ players, localPlayer }: { players: any[]; localPlayer: any }) {
  return (
    <>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#10b981" />
      </mesh>

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Players */}
      {players.map((player) => (
        <PlayerAvatar
          key={player.id}
          player={player}
          isLocalPlayer={localPlayer?.id === player.id}
        />
      ))}

      {/* Camera and controls */}
      <PerspectiveCamera makeDefault position={[0, 5, 15]} fov={50} />
      <OrbitControls target={[0, 1, 0]} minDistance={5} maxDistance={50} />
      <Environment preset="city" />
    </>
  )
}

export default function WorldPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const modelUrl = searchParams.get("modelUrl")

  const [nickname, setNickname] = useState("")
  const [color, setColor] = useState("#3b82f6")
  const [isJoining, setIsJoining] = useState(false)

  const { playerId, players, chatMessages, isConnected, error: hookError, onlineCount, joinWorld, sendMessage, leaveWorld } = useMultiplayerWorld(modelUrl || "")

  const [chatMessage, setChatMessage] = useState("")

  // If no model URL, show error
  if (!modelUrl) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 bg-card rounded-xl border border-border shadow-lg">
          <h1 className="text-2xl font-bold mb-4">No Avatar Generated</h1>
          <p className="text-muted-foreground mb-6">
            You need to generate a 3D avatar first before joining the multiplayer world.
          </p>
          <Link href="/avatar-builder">
            <Button className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Avatar Builder
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Join form
  if (!isConnected) {
    const handleJoin = async () => {
      if (!nickname.trim()) return
      setIsJoining(true)
      const success = await joinWorld(nickname, color)
      if (!success) {
        setIsJoining(false)
      }
    }

    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-8 bg-card rounded-xl border border-border shadow-lg space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Join World</h1>
            <p className="text-muted-foreground mt-2">Enter your nickname and join the multiplayer world</p>
          </div>

          {hookError && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive">{hookError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nickname</label>
              <Input
                placeholder="Enter your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={isJoining}
                onKeyDown={(e) => e.key === "Enter" && !isJoining && handleJoin()}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex gap-2">
                {["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"].map((c) => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          <Button onClick={handleJoin} disabled={!nickname.trim() || isJoining} className="w-full">
            {isJoining ? "Joining..." : "Join World"}
          </Button>

          <Link href="/avatar-builder">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Builder
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // World view
  return (
    <div className="w-full h-screen flex bg-background">
      {/* 3D Canvas */}
      <div className="flex-1">
        <Canvas shadows>
          <WorldScene players={players} localPlayer={players.find((p) => p.id === playerId)} />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="w-96 h-full bg-card border-l border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span className="font-semibold">Online: {onlineCount}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await leaveWorld()
                router.push("/avatar-builder")
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Leave
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Players in world
          </div>
        </div>

        {/* Players List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {players.map((player) => (
            <div key={player.id} className="p-2 bg-secondary rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: player.color || "#3b82f6" }}
                />
                <span className="font-medium">{player.nickname}</span>
                {player.id === playerId && <span className="text-xs text-primary ml-auto">(You)</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Chat */}
        <div className="border-t border-border p-4 space-y-4">
          <div className="h-32 bg-secondary rounded-lg overflow-y-auto p-2 space-y-1">
            {chatMessages.slice(-10).map((msg) => (
              <div key={msg.id} className="text-xs">
                <span className="font-semibold text-primary">{msg.username}:</span>
                <span className="text-muted-foreground ml-1">{msg.message}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Say something..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && chatMessage.trim()) {
                  sendMessage(chatMessage, players.find((p) => p.id === playerId)?.nickname || "Anonymous")
                  setChatMessage("")
                }
              }}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={() => {
                if (chatMessage.trim()) {
                  sendMessage(chatMessage, players.find((p) => p.id === playerId)?.nickname || "Anonymous")
                  setChatMessage("")
                }
              }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
