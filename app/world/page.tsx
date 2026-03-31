"use client"

// Multiplayer world - 3D environment with player sync and chat
import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Send, Users, LogOut, Play, ChevronDown, ChevronUp, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Animation library from Meshy (used for reference on home page)
const ANIMATION_LIBRARY = [
  { id: 0, name: "Idle", category: "DailyActions" },
  { id: 1, name: "Walking", category: "WalkAndRun" },
  { id: 14, name: "Running", category: "WalkAndRun" },
  { id: 22, name: "Funny Dancing 1", category: "Dancing" },
  { id: 23, name: "Funny Dancing 2", category: "Dancing" },
  { id: 24, name: "Funny Dancing 3", category: "Dancing" },
  { id: 28, name: "Wave Hello", category: "DailyActions" },
  { id: 44, name: "Happy Jump", category: "BodyMovements" },
  { id: 59, name: "Victory Cheer", category: "BodyMovements" },
  { id: 64, name: "All Night Dance", category: "Dancing" },
  { id: 66, name: "Boom Dance", category: "Dancing" },
  { id: 74, name: "Gangnam Groove", category: "Dancing" },
  { id: 82, name: "Shake It Off", category: "Dancing" },
  { id: 87, name: "Boxing Practice", category: "Fighting" },
  { id: 96, name: "Kung Fu Punch", category: "Fighting" },
  { id: 207, name: "Roundhouse Kick", category: "Fighting" },
  { id: 325, name: "Jump Push Up", category: "WorkingOut" },
  { id: 326, name: "Jumping Jacks", category: "WorkingOut" },
  { id: 375, name: "Handstand Flip", category: "BodyMovements" },
  { id: 395, name: "Breakdance", category: "BodyMovements" },
  { id: 412, name: "Victory", category: "BodyMovements" },
  { id: 452, name: "Backflip", category: "BodyMovements" },
]

interface GeneratedAnimation {
  id: number
  name: string
  modelUrl: string
}
import { useMultiplayerWorld } from "@/hooks/useMultiplayerWorld"
import { createClient } from "@/lib/supabase/client"
import dynamic from "next/dynamic"

const WorldScene = dynamic(() => import("@/components/world-scene"), { ssr: false })

import { Suspense } from "react"

function WorldPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const modelUrl = searchParams.get("modelUrl")
  const [nickname, setNickname] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [selectedCountry, setSelectedCountry] = useState("United States")
  const [joinedCountry, setJoinedCountry] = useState<string | null>(null)
  const [countryOptions, setCountryOptions] = useState<string[]>(["United States"])

  // Get user email for default nickname
  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
        setNickname(user.email.split('@')[0])
      }
    }
    getUser()
  }, [])
  const [color, setColor] = useState("#3b82f6")
  const [isJoining, setIsJoining] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [generatedAnimations, setGeneratedAnimations] = useState<GeneratedAnimation[]>([])
  const [animationPanelOpen, setAnimationPanelOpen] = useState(false)
  const [activeAnimationUrl, setActiveAnimationUrl] = useState<string | null>(null)
  const [availableAnimations, setAvailableAnimations] = useState<string[]>([])
  const [currentAnimation, setCurrentAnimation] = useState("")

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await fetch("https://restcountries.com/v3.1/all?fields=name")
        if (!response.ok) throw new Error("Failed to load country list")

        const data = await response.json()
        const countries = (data as Array<{ name?: { common?: string } }>)
          .map((item) => item.name?.common)
          .filter((name): name is string => Boolean(name))
          .sort((a, b) => a.localeCompare(b))

        if (countries.length > 0) {
          setCountryOptions(countries)
        }
      } catch (error) {
        console.warn("Failed to load countries, using fallback list:", error)
      }
    }

    loadCountries()
  }, [])

  // Load saved animations from user's player data
  useEffect(() => {
    const loadAnimations = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: savedAnimations } = await supabase
          .from('player_animations')
          .select('animation_id, animation_name, animation_url')
          .eq('user_id', user.id)
        
        if (savedAnimations && savedAnimations.length > 0) {
          setGeneratedAnimations(savedAnimations.map(a => ({
            id: a.animation_id,
            name: a.animation_name,
            modelUrl: a.animation_url
          })))
        }
      }
    }
    
    loadAnimations()
  }, [])

  // Load available animations from the model
  useEffect(() => {
    if (!modelUrl) return
    
    const loadAnimations = async () => {
      try {
        // Fetch the model to extract animation names
        const proxiedUrl = modelUrl.startsWith("/api/proxy-model") || modelUrl.startsWith("/") 
          ? modelUrl 
          : `/api/proxy-model?url=${encodeURIComponent(modelUrl)}`
        
        const response = await fetch(proxiedUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch model (${response.status})`)
        }

        const arrayBuffer = await response.arrayBuffer()
        
        // Parse GLB to extract animation names using minimal parsing
        if (arrayBuffer.byteLength < 20) {
          return
        }

        const dataView = new DataView(arrayBuffer)
        const magic = dataView.getUint32(0, true)
        // Binary glTF magic: "glTF" (0x46546C67)
        if (magic !== 0x46546c67) {
          return
        }

        const decoder = new TextDecoder()
        
        // GLB structure: 12 byte header, then chunks
        // We need to find the JSON chunk and parse it for animation names
        if (arrayBuffer.byteLength > 20) {
          const jsonLength = dataView.getUint32(12, true)
          const jsonStart = 20
          if (jsonLength <= 0 || jsonStart + jsonLength > arrayBuffer.byteLength) {
            return
          }

          const jsonData = decoder.decode(new Uint8Array(arrayBuffer, 20, jsonLength))
          const gltf = JSON.parse(jsonData)
          
          if (gltf.animations && gltf.animations.length > 0) {
            const animNames = gltf.animations.map((a: { name?: string }, i: number) => a.name || `Animation ${i + 1}`)
            setAvailableAnimations(animNames)
            setCurrentAnimation(animNames[0])
          }
        }
      } catch (err) {
        console.error("Failed to load animations:", err)
      }
    }
    
    loadAnimations()
  }, [modelUrl])

  const {
    playerId,
    players,
    chatMessages,
    isConnected,
    error: hookError,
    onlineCount,
    joinWorld,
    updatePosition,
    updateAnimation,
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
    if (!nickname.trim() || !selectedCountry) return
    setIsJoining(true)
    const success = await joinWorld(nickname, color)
    if (!success) {
      setIsJoining(false)
      return
    }
    setJoinedCountry(selectedCountry)
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
              <label className="text-sm font-medium mb-2 block">Country</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {countryOptions.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <Button onClick={handleJoinWorld} disabled={!nickname.trim() || !selectedCountry || isJoining} className="w-full">
            {isJoining ? "Joining..." : "Enter World"}
          </Button>

          <Link href="/">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
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
          <WorldScene
            players={players}
            localPlayerId={playerId}
            modelUrl={activeAnimationUrl || modelUrl}
            originalModelUrl={modelUrl}
            onPositionChange={updatePosition}
          />
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
          <p className="text-xs text-muted-foreground">
            Use Arrow Keys to move{joinedCountry ? ` • Location: ${joinedCountry}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">Use Arrow Keys to move</p>
          
          {/* Animation Selector */}
          {availableAnimations.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Play className="h-4 w-4" />
                Animation
              </label>
              <Select value={currentAnimation} onValueChange={setCurrentAnimation}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select animation" />
                </SelectTrigger>
                <SelectContent>
                  {availableAnimations.map((anim) => (
                    <SelectItem key={anim} value={anim}>
                      {anim}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Animation Selection Panel - only shows saved animations */}
        {generatedAnimations.length > 0 && (
          <div className="border-b border-border">
            <button
              onClick={() => setAnimationPanelOpen(!animationPanelOpen)}
              className="w-full p-4 flex items-center justify-between text-sm font-medium hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Select Animation
              </div>
              {animationPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            
            {animationPanelOpen && (
              <div className="px-4 pb-4 space-y-2">
                {/* Use Base Model Button */}
                <button
                  onClick={() => {
                    setActiveAnimationUrl(null)
                    updateAnimation(null)
                  }}
                  className={`w-full p-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                    !activeAnimationUrl 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-secondary hover:bg-secondary/80"
                  }`}
                >
                  <RotateCcw className="h-3 w-3" />
                  Base Model
                </button>

                {/* Saved animations */}
                {generatedAnimations.map((anim) => (
                  <button
                    key={anim.id}
                    onClick={() => {
                      setActiveAnimationUrl(anim.modelUrl)
                      updateAnimation(anim.modelUrl)
                    }}
                    className={`w-full p-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                      activeAnimationUrl === anim.modelUrl 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    <Play className="h-3 w-3" />
                    {anim.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
