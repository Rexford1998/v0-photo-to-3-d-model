"use client"

// Multiplayer world - 3D environment with player sync and chat
import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Send, Users, LogOut, Play, Plus, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"

// Animation library from Meshy
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
  const [currentAnimation, setCurrentAnimation] = useState<string>("")
  const [availableAnimations, setAvailableAnimations] = useState<string[]>([])
  const [generatedAnimations, setGeneratedAnimations] = useState<GeneratedAnimation[]>([])
  const [isGeneratingAnimation, setIsGeneratingAnimation] = useState(false)
  const [animationProgress, setAnimationProgress] = useState(0)
  const [selectedAnimationId, setSelectedAnimationId] = useState<number | null>(null)
  const [animationPanelOpen, setAnimationPanelOpen] = useState(false)
  const [rigTaskId, setRigTaskId] = useState<string | null>(null)
  const [activeAnimationUrl, setActiveAnimationUrl] = useState<string | null>(null)
  const [isRigging, setIsRigging] = useState(false)
  const [riggingProgress, setRiggingProgress] = useState(0)

  // Load rig task ID from user's player data
  useEffect(() => {
    const loadRigTaskId = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: playerData } = await supabase
          .from('players')
          .select('rig_task_id')
          .eq('user_id', user.id)
          .single()
        
        if (playerData?.rig_task_id) {
          setRigTaskId(playerData.rig_task_id)
        }
      }
    }
    
    loadRigTaskId()
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
        const arrayBuffer = await response.arrayBuffer()
        
        // Parse GLB to extract animation names using minimal parsing
        const dataView = new DataView(arrayBuffer)
        const decoder = new TextDecoder()
        
        // GLB structure: 12 byte header, then chunks
        // We need to find the JSON chunk and parse it for animation names
        if (arrayBuffer.byteLength > 20) {
          const jsonLength = dataView.getUint32(12, true)
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

  // Rig the existing model to enable animations
  const rigExistingModel = async () => {
    if (!modelUrl) {
      console.log("[v0] No model URL provided")
      return
    }

    console.log("[v0] Starting rig process for model:", modelUrl)
    setIsRigging(true)
    setRiggingProgress(0)

    try {
      // Extract the original model URL from the proxy URL
      let originalModelUrl = modelUrl
      if (modelUrl.includes('/api/proxy-model?url=')) {
        const urlParam = new URL(modelUrl, window.location.origin).searchParams.get('url')
        if (urlParam) originalModelUrl = urlParam
      }

      console.log("[v0] Original model URL for rigging:", originalModelUrl)

      // Start rigging
      const rigResponse = await fetch('/api/meshy/rigging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelUrl: originalModelUrl }),
      })

      if (!rigResponse.ok) {
        const error = await rigResponse.json()
        throw new Error(error.error || 'Failed to start rigging')
      }

      const { taskId } = await rigResponse.json()
      console.log("[v0] Rigging task started with ID:", taskId)

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          console.log("[v0] Polling rigging status for task:", taskId)
          const statusResponse = await fetch(`/api/meshy/rigging/${taskId}`)
          const status = await statusResponse.json()
          console.log("[v0] Rigging status:", status)

          setRiggingProgress(status.progress || 0)

          if (status.status === 'SUCCEEDED') {
            clearInterval(pollInterval)
            setIsRigging(false)
            setRigTaskId(taskId)

            // Save the rig task ID to the database
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              await supabase
                .from('players')
                .update({ rig_task_id: taskId })
                .eq('user_id', user.id)
            }

            alert('Model rigged successfully! You can now create animations.')
          } else if (status.status === 'FAILED') {
            clearInterval(pollInterval)
            setIsRigging(false)
            alert(`Rigging failed: ${status.error || 'Unknown error'}`)
          }
        } catch (err) {
          console.error('Rigging poll error:', err)
        }
      }, 2000)
    } catch (error) {
      console.error('Rigging error:', error)
      setIsRigging(false)
      alert(error instanceof Error ? error.message : 'Failed to rig model')
    }
  }

  // Generate animation from Meshy
  const generateAnimation = async (actionId: number, animName: string) => {
    if (!rigTaskId) {
      alert("No rigged model found. Please generate a rigged model first.")
      return
    }

    console.log("[v0] Starting animation generation:", { rigTaskId, actionId, animName })
    setIsGeneratingAnimation(true)
    setSelectedAnimationId(actionId)
    setAnimationProgress(0)

    try {
      // Start animation generation
      console.log("[v0] Creating animation task...")
      const createResponse = await fetch("/api/meshy/animation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rigTaskId, actionId }),
      })

      if (!createResponse.ok) {
        const error = await createResponse.json()
        console.error("[v0] Animation creation failed:", error)
        throw new Error(error.error || "Failed to start animation")
      }

      const { taskId } = await createResponse.json()
      console.log("[v0] Animation task created:", taskId)

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          console.log("[v0] Polling animation status for:", taskId)
          const statusResponse = await fetch(`/api/meshy/animation/${taskId}`)
          const status = await statusResponse.json()
          console.log("[v0] Animation status:", status)

          setAnimationProgress(status.progress || 0)

          if (status.status === "SUCCEEDED" && status.modelUrl) {
            console.log("[v0] Animation completed! Model URL:", status.modelUrl)
            clearInterval(pollInterval)
            setIsGeneratingAnimation(false)
            setSelectedAnimationId(null)
            
            // Add to generated animations
            const newAnim: GeneratedAnimation = {
              id: actionId,
              name: animName,
              modelUrl: status.modelUrl,
            }
            setGeneratedAnimations(prev => [...prev.filter(a => a.id !== actionId), newAnim])
            
            // Set as active animation
            setActiveAnimationUrl(status.modelUrl)
          } else if (status.status === "FAILED") {
            console.error("[v0] Animation failed:", status.error)
            clearInterval(pollInterval)
            setIsGeneratingAnimation(false)
            setSelectedAnimationId(null)
            alert(`Animation failed: ${status.error || "Unknown error"}`)
          }
        } catch (err) {
          console.error("[v0] Polling error:", err)
        }
      }, 2000)

      // Cleanup on unmount
      return () => clearInterval(pollInterval)
    } catch (error) {
      console.error("Animation generation error:", error)
      setIsGeneratingAnimation(false)
      setSelectedAnimationId(null)
      alert(error instanceof Error ? error.message : "Failed to generate animation")
    }
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
            onPositionChange={updatePosition} 
            currentAnimation={currentAnimation} 
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
          <p className="text-xs text-muted-foreground">Use WASD or Arrow Keys to move</p>
          
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

        {/* Animation Generation Panel */}
        <div className="border-b border-border">
          <button
            onClick={() => setAnimationPanelOpen(!animationPanelOpen)}
            className="w-full p-4 flex items-center justify-between text-sm font-medium hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Animations
            </div>
            {animationPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {animationPanelOpen && (
            <div className="px-4 pb-4 space-y-3 max-h-60 overflow-y-auto">
              {/* Rig Model Section - show if no rig task ID */}
              {!rigTaskId && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-amber-600">Model Not Rigged</p>
                  <p className="text-xs text-muted-foreground">
                    Your model needs to be rigged before you can create animations.
                  </p>
                  {isRigging ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Rigging model...
                      </div>
                      <Progress value={riggingProgress} className="h-2" />
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={rigExistingModel}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Rig Model for Animations
                    </Button>
                  )}
                </div>
              )}

              {/* Generated animations */}
              {generatedAnimations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Your Animations</p>
                  {generatedAnimations.map((anim) => (
                    <button
                      key={anim.id}
                      onClick={() => setActiveAnimationUrl(anim.modelUrl)}
                      className={`w-full p-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                        activeAnimationUrl === anim.modelUrl 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-secondary hover:bg-secondary/80"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                      {anim.name}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Animation library - only show if rigged */}
              {rigTaskId && (
                <>
                  <p className="text-xs text-muted-foreground font-medium">Animation Library</p>
                  {isGeneratingAnimation && (
                <div className="p-3 bg-secondary rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating animation...
                  </div>
                  <Progress value={animationProgress} className="h-2" />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                {ANIMATION_LIBRARY.map((anim) => {
                  const isGenerated = generatedAnimations.some(g => g.id === anim.id)
                  const isGenerating = selectedAnimationId === anim.id && isGeneratingAnimation
                  
                  return (
                    <button
                      key={anim.id}
                      onClick={() => !isGenerated && !isGeneratingAnimation && generateAnimation(anim.id, anim.name)}
                      disabled={isGeneratingAnimation || isGenerated}
                      className={`p-2 rounded-lg text-xs text-left transition-colors ${
                        isGenerated 
                          ? "bg-green-500/20 text-green-600 cursor-default"
                          : isGenerating
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary hover:bg-secondary/80"
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-center gap-1">
                        {isGenerated && <Check className="h-3 w-3" />}
                        {isGenerating && <Loader2 className="h-3 w-3 animate-spin" />}
                        <span className="truncate">{anim.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{anim.category}</span>
                    </button>
                  )
                })}
              </div>
                </>
              )}
            </div>
          )}
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
