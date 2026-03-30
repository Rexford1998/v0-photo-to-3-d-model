"use client"

// Multiplayer world - 3D environment with player sync and chat
import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Send, Users, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useMultiplayerWorld } from "@/hooks/useMultiplayerWorld"
import { createClient } from "@/lib/supabase/client"
import dynamic from "next/dynamic"

const WorldScene = dynamic(() => import("@/components/world-scene"), { ssr: false })

import { Suspense } from "react"

function WorldPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const modelUrl = searchParams.get("modelUrl")
  
  console.log("[v0] World page loaded, modelUrl:", modelUrl ? "present" : "missing", modelUrl?.substring(0, 50))
  
  const [nickname, setNickname] = useState("")
  const [color, setColor] = useState("#3b82f6")
  const [isJoining, setIsJoining] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Get the authenticated user
  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
        // Set default nickname from email (before @)
        const defaultNickname = user.email.split('@')[0]
        setNickname(defaultNickname)
      }
    }
    getUser()
  }, [])

  const {
    playerId,
    players,
    chatMessages,
    isConnected,
    error: hookError,
    onlineCount,
    joinWorld,
    updatePosition,
    sendMessage,
    leaveWorld,
  } = useMultiplayerWorld(modelUrl || "")

  if (!modelUrl) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            Please generate a 3D avatar first to access the multiplayer world.
          </p>
          <Link href="/">
            <Button className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Generator
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  const handleJoinWorld = async () => {
    if (!nickname.trim()) return
    setIsJoining(true)
    const success = await joinWorld(nickname, color)
    if (!success) {
      setIsJoining(false)
    }
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return
    await sendMessage(chatInput, nickname)
    setChatInput("")
  }

  const handleLeaveWorld = async () => {
    await leaveWorld()
    router.push("/")
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  // Join form
  if (!isConnected) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-xl border border-border p-8 space-y-6 shadow-lg">
          <div>
            <h1 className="text-3xl font-bold">Join World</h1>
            <p className="text-muted-foreground mt-2">
              {userEmail ? `Logged in as ${userEmail}` : "Enter your nickname and join other players"}
            </p>
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
                onKeyDown={(e) => e.key === "Enter" && !isJoining && handleJoinWorld()}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Avatar Color</label>
              <div className="flex gap-2">
                {["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"].map((c) => (
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

          <Button onClick={handleJoinWorld} disabled={!nickname.trim() || isJoining} className="w-full">
            {isJoining ? "Joining..." : "Enter World"}
          </Button>

          <div className="flex gap-2">
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // World view
  return (
    <main className="min-h-screen bg-background flex">
      {/* 3D Canvas */}
      <div className="flex-1">
        <Suspense fallback={<div className="flex items-center justify-center h-full w-full">Loading 3D world...</div>}>
          <WorldScene players={players} localPlayerId={playerId} modelUrl={modelUrl} onPositionChange={updatePosition} />
        </Suspense>
      </div>

      {/* UI Panel */}
      <div className="w-96 h-screen bg-card border-l border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span className="font-semibold">Online: {onlineCount}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeaveWorld}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Leave
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Use WASD or Arrow Keys to move</p>
        </div>

        {/* Players List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-sm font-semibold mb-3">Players ({players.length})</div>
          {players.map((player) => (
            <div key={player.id} className="p-3 bg-secondary rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: player.color }}
                />
                <span className="font-medium">{player.nickname}</span>
                {player.id === playerId && <span className="text-xs text-primary ml-auto">(You)</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Chat */}
        <div className="border-t border-border p-4 space-y-4">
          <div className="h-40 bg-secondary rounded-lg overflow-y-auto p-3 space-y-2">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="text-xs">
                <span className="font-semibold text-primary">{msg.username}:</span>
                <span className="text-muted-foreground ml-1">{msg.message}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Say something..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && chatInput.trim()) {
                  handleSendMessage()
                }
              }}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleSendMessage}
              disabled={!chatInput.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function WorldPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <WorldPageContent />
    </Suspense>
  )
}
