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

// Compress image to avoid 413 Payload Too Large errors
// Vercel server actions have ~4.5MB limit, compress to stay under
async function compressImage(dataUrl: string, maxSizeKB: number = 1500): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      
      // Scale down large images
      const maxDimension = 1024
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }
      
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      
      ctx.drawImage(img, 0, 0, width, height)
      
      // Start with high quality and reduce until under size limit
      let quality = 0.9
      let result = canvas.toDataURL('image/jpeg', quality)
      
      while (result.length > maxSizeKB * 1024 && quality > 0.1) {
        quality -= 0.1
        result = canvas.toDataURL('image/jpeg', quality)
      }
      
      console.log(`[v0] Image compressed: ${Math.round(result.length / 1024)}KB at quality ${quality.toFixed(1)}`)
      resolve(result)
    }
    img.onerror = () => reject(new Error('Failed to load image for compression'))
    img.src = dataUrl
  })
}

export function useMeshy(): UseMeshyResult {
  const [stage, setStage] = useState<GenerationStage>("idle")
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const [animationUrl, setAnimationUrl] = useState<string | null>(null)
  const [rigTaskId, setRigTaskId] = useState<string | null>(null)
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
    setRigTaskId(null)
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
      // Step 1: Compress image to avoid 413 Payload Too Large errors
      setStage("uploading")
      setCurrentStep(0)
      setProgress(0)
      
      let compressedImage: string
      try {
        compressedImage = await compressImage(imageDataUrl)
      } catch (compressError) {
        console.error("[v0] Image compression failed:", compressError)
        compressedImage = imageDataUrl // Fall back to original if compression fails
      }

      // Step 2: Start Image to 3D generation
      setStage("generating")
      setProgress(0)

      // Use Server Action to bypass 4MB/1MB Route Handler body size limits
      const taskId = await createImageTo3DTask(compressedImage)

      // Poll for Image to 3D completion
      const task = await pollTask(taskId, signal)
      
      if (!task.model_urls?.glb) {
        throw new Error("No model URL in task result")
      }

      const generatedModelUrl = task.model_urls.glb
      setModelUrl(getProxiedUrl(generatedModelUrl))

      // Step 2: Attempt rigging for walking animation (optional - many models won't be riggable)
      // Rigging requires a humanoid model with clear body pose - photo-based models often fail
      setStage("rigging")
      setCurrentStep(1)
      setProgress(0)

      // Skip rigging if URL is invalid
      if (!generatedModelUrl || !generatedModelUrl.startsWith("http")) {
        setStage("complete")
        setCurrentStep(2)
        return
      }
      
      // Try rigging but don't fail the whole process if it doesn't work
      try {
        const riggingResponse = await fetch("/api/meshy/rigging", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelUrl: generatedModelUrl }),
          signal,
        })

        if (riggingResponse.ok) {
          const riggingData = await riggingResponse.json()
          
          if (riggingData.taskId) {
            // Poll for rigging completion
            const riggingTask = await pollRiggingTask(riggingData.taskId, signal)

            // Store the rig task ID for animation generation
            setRigTaskId(riggingData.taskId)

            // Set the walking animation URL if available
            if (riggingTask.result?.basic_animations?.walking_glb_url) {
              setAnimationUrl(getProxiedUrl(riggingTask.result.basic_animations.walking_glb_url))
            } else if (riggingTask.result?.rigged_character_glb_url) {
              setAnimationUrl(getProxiedUrl(riggingTask.result.rigged_character_glb_url))
            }
          }
        }
        // If rigging fails for any reason, we just continue without animation
      } catch {
        // Rigging is optional - silently continue without animation
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
    rigTaskId,
    error,
    generateModel,
    reset,
  }
}
