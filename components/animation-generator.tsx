"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Check, Loader2, Play, ChevronDown, ChevronUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// Animation library from Meshy API
const ANIMATION_LIBRARY = [
  { id: 0, name: "Idle", category: "DailyActions" },
  { id: 1, name: "Walking", category: "WalkAndRun" },
  { id: 14, name: "Running", category: "WalkAndRun" },
  { id: 22, name: "Funny Dancing 1", category: "Dancing" },
  { id: 23, name: "Funny Dancing 2", category: "Dancing" },
  { id: 24, name: "Funny Dancing 3", category: "Dancing" },
]

interface GeneratedAnimation {
  id: number
  name: string
  modelUrl: string
}

interface AnimationGeneratorProps {
  rigTaskId: string
  userId: string
}

export function AnimationGenerator({ rigTaskId, userId }: AnimationGeneratorProps) {
  const [expanded, setExpanded] = useState(false)
  const [generatedAnimations, setGeneratedAnimations] = useState<GeneratedAnimation[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentAnimationId, setCurrentAnimationId] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [selectedAnimations, setSelectedAnimations] = useState<number[]>([])

  // Load saved animations on mount
  useEffect(() => {
    const loadSavedAnimations = async () => {
      // TODO: Implement saved animations lookup without user_id
      // const supabase = createClient()
      // const { data } = await supabase
      //   .from("player_animations")
      //   .select("animation_id, animation_name, animation_url")
      //   .eq("nickname", nickname)

      // if (data && data.length > 0) {
      //   setGeneratedAnimations(
      //     data.map((a) => ({
      //       id: a.animation_id,
      //       name: a.animation_name,
      //       modelUrl: a.animation_url,
      //     }))
      //   )
      // }
    }
    loadSavedAnimations()
  }, [userId])

  const toggleAnimation = (id: number) => {
    const isGenerated = generatedAnimations.some((a) => a.id === id)
    if (isGenerated) return // Already generated, can't toggle

    setSelectedAnimations((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const generateSelectedAnimations = async () => {
    if (selectedAnimations.length === 0 || isGenerating) return

    setIsGenerating(true)

    for (const animId of selectedAnimations) {
      const anim = ANIMATION_LIBRARY.find((a) => a.id === animId)
      if (!anim) continue

      setCurrentAnimationId(animId)
      setProgress(0)

      try {
        // Start animation generation
        const createResponse = await fetch("/api/meshy/animation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rigTaskId, actionId: animId }),
        })

        if (!createResponse.ok) {
          console.error("Failed to start animation:", animId)
          continue
        }

        const { taskId } = await createResponse.json()

        // Poll for completion
        let completed = false
        while (!completed) {
          await new Promise((resolve) => setTimeout(resolve, 2000))

          const statusResponse = await fetch(`/api/meshy/animation/${taskId}`)
          const status = await statusResponse.json()

          setProgress(status.progress || 0)

          if (status.status === "SUCCEEDED" && status.modelUrl) {
            completed = true

            // Add to generated animations
            const newAnim: GeneratedAnimation = {
              id: animId,
              name: anim.name,
              modelUrl: status.modelUrl,
            }
            setGeneratedAnimations((prev) => [
              ...prev.filter((a) => a.id !== animId),
              newAnim,
            ])

            // Save to database
            const supabase = createClient()
            await supabase.from("player_animations").upsert(
              {
                user_id: userId,
                animation_id: animId,
                animation_name: anim.name,
                animation_url: status.modelUrl,
              },
              { onConflict: "user_id,animation_id" }
            )
          } else if (status.status === "FAILED") {
            completed = true
            console.error("Animation failed:", animId, status.error)
          }
        }
      } catch (error) {
        console.error("Animation generation error:", error)
      }
    }

    setIsGenerating(false)
    setCurrentAnimationId(null)
    setSelectedAnimations([])
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-sm font-medium hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          Generate Animations ({generatedAnimations.length} saved)
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Select animations to generate. These will be saved and available in the multiplayer world.
          </p>

          {isGenerating && currentAnimationId !== null && (
            <div className="p-3 bg-secondary rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating{" "}
                {ANIMATION_LIBRARY.find((a) => a.id === currentAnimationId)?.name}...
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ANIMATION_LIBRARY.map((anim) => {
              const isGenerated = generatedAnimations.some((g) => g.id === anim.id)
              const isSelected = selectedAnimations.includes(anim.id)
              const isCurrentlyGenerating =
                isGenerating && currentAnimationId === anim.id

              return (
                <button
                  key={anim.id}
                  onClick={() => toggleAnimation(anim.id)}
                  disabled={isGenerating || isGenerated}
                  className={`p-3 rounded-lg text-xs text-left transition-colors border-2 ${
                    isGenerated
                      ? "bg-green-500/10 border-green-500/30 text-green-600"
                      : isSelected
                      ? "bg-primary/10 border-primary text-primary"
                      : isCurrentlyGenerating
                      ? "bg-primary/20 border-primary/50"
                      : "bg-secondary border-transparent hover:bg-secondary/80"
                  } disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-1">
                    {isGenerated && <Check className="h-3 w-3" />}
                    {isCurrentlyGenerating && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {isSelected && !isGenerated && (
                      <div className="h-3 w-3 rounded-sm border-2 border-primary bg-primary" />
                    )}
                    {!isSelected && !isGenerated && !isCurrentlyGenerating && (
                      <div className="h-3 w-3 rounded-sm border-2 border-muted-foreground/30" />
                    )}
                    <span className="truncate">{anim.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {anim.category}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedAnimations.length > 0 && !isGenerating && (
            <Button onClick={generateSelectedAnimations} className="w-full">
              Generate {selectedAnimations.length} Animation
              {selectedAnimations.length > 1 ? "s" : ""}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
