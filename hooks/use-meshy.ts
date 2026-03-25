"use client"

import { useState, useCallback, useRef } from "react"

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
  loading: boolean
  error: string | null
  generateModel: (imageFile: File) => Promise<void>
  startRigging: (modelUrl: string) => Promise<void>
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

  const generateModel = useCallback(async (imageFile: File) => {
    reset()
    
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      // Step 1: Convert File to base64 data URL
      setStage("uploading")
      setCurrentStep(0)
      setProgress(0)

      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(imageFile)
      })

      // Step 2: Start Image to 3D generation
      setStage("generating")
      setProgress(10)

      const createResponse = await fetch("/api/meshy/image-to-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageDataUrl }),
        signal,
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        throw new Error(errorData.error || "Failed to start generation")
      }

      const { taskId } = await createResponse.json()

      // Poll for Image to 3D completion
      const task = await pollTask(taskId, signal)
      
      if (!task.model_urls?.glb) {
        throw new Error("No model URL in task result")
      }

      const generatedModelUrl = task.model_urls.glb
      setModelUrl(getProxiedUrl(generatedModelUrl))
      
      // Model generation complete - user can now choose to add animation
      setStage("complete")
      setCurrentStep(1)

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return
      }
      console.error("Generation error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
      setStage("error")
    }
  }, [reset])

  const startRigging = useCallback(async (modelUrlToRig: string) => {
    if (!modelUrlToRig) return
    
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      setStage("rigging")
      setCurrentStep(1)
      setProgress(0)

      const riggingResponse = await fetch("/api/meshy/rigging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelUrl: modelUrlToRig }),
        signal,
      })

      if (!riggingResponse.ok) {
        const errorData = await riggingResponse.json()
        throw new Error(errorData.error || "Failed to start rigging")
      }

      const { taskId: riggingTaskId } = await riggingResponse.json()
      const riggingTask = await pollRiggingTask(riggingTaskId, signal)

      if (riggingTask.result?.basic_animations?.walking_glb_url) {
        setAnimationUrl(getProxiedUrl(riggingTask.result.basic_animations.walking_glb_url))
      } else if (riggingTask.result?.rigged_character_glb_url) {
        setAnimationUrl(getProxiedUrl(riggingTask.result.rigged_character_glb_url))
      }

      setStage("complete")
      setCurrentStep(2)

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      console.error("Rigging error:", err)
      setError(err instanceof Error ? err.message : "Rigging failed")
      setStage("error")
    }
  }, [])

  const loading = stage === "uploading" || stage === "generating" || stage === "rigging"

  return {
    stage,
    currentStep,
    progress,
    modelUrl,
    animationUrl,
    loading,
    error,
    generateModel,
    startRigging,
    reset,
  }
}
