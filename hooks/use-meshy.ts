"use client"

// Meshy API Hook - Build: 2026-03-25-v4
import { useState, useCallback, useRef } from "react"
import { createImageTo3DTask } from "@/actions/meshy"

interface MeshyTask {
  id: string
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED"
  progress: number
  model_urls?: {
    glb?: string
    fbx?: string
    obj?: string
  }
  task_error?: {
    message: string
  }
}

interface RiggingTask {
  id: string
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED"
  progress: number
  result?: {
    rigged_character_glb_url: string
    basic_animations?: {
      walking_glb_url?: string
      running_glb_url?: string
    }
  }
  task_error?: {
    message: string
  }
}

export type GenerationStage = 
  | "idle"
  | "uploading"
  | "generating"
  | "rigging"
  | "complete"
  | "error"

interface UseMeshyResult {
  stage: GenerationStage
  currentStep: number
  progress: number
  modelUrl: string | null
  animationUrl: string | null
  error: string | null
  generateModel: (imageDataUrl: string) => Promise<void>
  reset: () => void
}

// Convert external URLs to proxied URLs to avoid CORS issues
function getProxiedUrl(url: string): string {
  // If already a proxied URL or local URL, return as-is
  if (url.startsWith("/api/proxy-model") || url.startsWith("/")) {
    return url
  }
  return `/api/proxy-model?url=${encodeURIComponent(url)}`
}

export function useMeshy(): UseMeshyResult {
  const [stage, setStage] = useState<GenerationStage>("idle")
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const [animationUrl, setAnimationUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setStage("idle")
    setCurrentStep(0)
    setProgress(0)
    setModelUrl(null)
    setAnimationUrl(null)
    setError(null)
  }, [])

  const pollTask = async (
    taskId: string,
    signal: AbortSignal
  ): Promise<MeshyTask> => {
    const maxAttempts = 120 // 10 minutes max
    let attempts = 0

    while (attempts < maxAttempts) {
      if (signal.aborted) throw new Error("Generation cancelled")

      const response = await fetch(`/api/meshy/task/${taskId}`, { signal })
      if (!response.ok) throw new Error("Failed to fetch task status")

      const task: MeshyTask = await response.json()
      
      setProgress(task.progress)

      if (task.status === "SUCCEEDED") {
        return task
      }

      if (task.status === "FAILED" || task.status === "CANCELED") {
        throw new Error(task.task_error?.message || "Task failed")
      }

      await new Promise((resolve) => setTimeout(resolve, 5000))
      attempts++
    }

    throw new Error("Task timed out")
  }

  const pollRiggingTask = async (
    taskId: string,
    signal: AbortSignal
  ): Promise<RiggingTask> => {
    const maxAttempts = 120 // 10 minutes max
    let attempts = 0

    while (attempts < maxAttempts) {
      if (signal.aborted) throw new Error("Generation cancelled")

      const response = await fetch(`/api/meshy/rigging/${taskId}`, { signal })
      if (!response.ok) throw new Error("Failed to fetch rigging task status")

      const task: RiggingTask = await response.json()
      
      setProgress(task.progress)

      if (task.status === "SUCCEEDED") {
        return task
      }

      if (task.status === "FAILED" || task.status === "CANCELED") {
        throw new Error(task.task_error?.message || "Rigging task failed")
      }

      await new Promise((resolve) => setTimeout(resolve, 5000))
      attempts++
    }

    throw new Error("Rigging task timed out")
  }

  const generateModel = useCallback(async (imageDataUrl: string) => {
    reset()
    
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      // Step 1: Start Image to 3D generation
      setStage("generating")
      setCurrentStep(0)
      setProgress(0)

      // Use Server Action to bypass 4MB/1MB Route Handler body size limits
      const taskId = await createImageTo3DTask(imageDataUrl)

      // Poll for Image to 3D completion
      const task = await pollTask(taskId, signal)
      
      if (!task.model_urls?.glb) {
        throw new Error("No model URL in task result")
      }

      const generatedModelUrl = task.model_urls.glb
      setModelUrl(getProxiedUrl(generatedModelUrl))

      // Step 2: Start rigging to get walking animation
      setStage("rigging")
      setCurrentStep(1)
      setProgress(0)

      let riggingTaskId: string | null = null
      
      try {
        const riggingResponse = await fetch("/api/meshy/rigging", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelUrl: generatedModelUrl }),
          signal,
        })

        if (!riggingResponse.ok) {
          // If rigging fails, still show the static model
          console.warn("Rigging failed, showing static model")
          setStage("complete")
          setCurrentStep(2)
          return
        }

        const riggingData = await riggingResponse.json()
        riggingTaskId = riggingData.taskId
      } catch (riggingErr) {
        console.warn("Rigging request failed, showing static model:", riggingErr)
        setStage("complete")
        setCurrentStep(2)
        return
      }

      if (!riggingTaskId) {
        console.warn("No rigging task ID, showing static model")
        setStage("complete")
        setCurrentStep(2)
        return
      }

      // Poll for rigging completion
      try {
        const riggingTask = await pollRiggingTask(riggingTaskId, signal)

        // Set the walking animation URL if available
        if (riggingTask.result?.basic_animations?.walking_glb_url) {
          setAnimationUrl(getProxiedUrl(riggingTask.result.basic_animations.walking_glb_url))
        } else if (riggingTask.result?.rigged_character_glb_url) {
          // Use rigged character if no walking animation
          setAnimationUrl(getProxiedUrl(riggingTask.result.rigged_character_glb_url))
        }
      } catch (pollErr) {
        console.warn("Rigging poll failed, showing static model:", pollErr)
      }

      setStage("complete")
      setCurrentStep(2)

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return
      }
      console.error("Generation error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
      setStage("error")
    }
  }, [reset])

  return {
    stage,
    currentStep,
    progress,
    modelUrl,
    animationUrl,
    error,
    generateModel,
    reset,
  }
}
