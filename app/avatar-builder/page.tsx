"use client"

import { useState, useEffect, useCallback } from "react"
import { Upload } from "@/components/avatar/Upload"
import { CameraCapture } from "@/components/avatar/CameraCapture"
import BodyCustomizer from "@/components/avatar/BodyCustomizer"
import { useAvatar } from "@/hooks/useAvatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Download, Camera, UploadCloud, Wand2, Loader2 } from "lucide-react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment, useGLTF } from "@react-three/drei"

// Component to load and display GLB model from URL
function MeshyModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}

interface GenerationState {
  status: "idle" | "starting" | "pending" | "in_progress" | "succeeded" | "failed"
  taskId: string | null
  progress: number
  modelUrl: string | null
  error: string | null
}

export default function AvatarBuilderPage() {
  const { headUrl, setHeadUrl, bodySettings, setBodySettings } = useAvatar()
  const [captureMode, setCaptureMode] = useState<"upload" | "camera">("upload")
  
  const [generation, setGeneration] = useState<GenerationState>({
    status: "idle",
    taskId: null,
    progress: 0,
    modelUrl: null,
    error: null
  })

  const handleInput = (url: string) => {
    setHeadUrl(url)
    // Reset generation when new image is uploaded
    setGeneration({
      status: "idle",
      taskId: null,
      progress: 0,
      modelUrl: null,
      error: null
    })
  }

  // Poll for task status
  const pollTaskStatus = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/generate-avatar?taskId=${taskId}`)
      const data = await response.json()

      if (data.error) {
        setGeneration(prev => ({
          ...prev,
          status: "failed",
          error: data.error
        }))
        return
      }

      if (data.status === "SUCCEEDED" && data.modelUrl) {
        setGeneration(prev => ({
          ...prev,
          status: "succeeded",
          progress: 100,
          modelUrl: data.modelUrl
        }))
        return
      }

      if (data.status === "FAILED") {
        setGeneration(prev => ({
          ...prev,
          status: "failed",
          error: data.error || "Generation failed"
        }))
        return
      }

      // Still in progress - update progress and continue polling
      setGeneration(prev => ({
        ...prev,
        status: data.status === "PENDING" ? "pending" : "in_progress",
        progress: data.progress || 0
      }))

      // Continue polling after 2 seconds
      setTimeout(() => pollTaskStatus(taskId), 2000)
    } catch {
      setGeneration(prev => ({
        ...prev,
        status: "failed",
        error: "Failed to check generation status"
      }))
    }
  }, [])

  const handleGenerate = async () => {
    if (!headUrl) return

    setGeneration({
      status: "starting",
      taskId: null,
      progress: 0,
      modelUrl: null,
      error: null
    })

    try {
      const response = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: headUrl,
          gender: bodySettings.gender,
          height: bodySettings.height,
          weight: bodySettings.weight,
          clothing: bodySettings.clothing
        })
      })

      const data = await response.json()

      if (data.error) {
        setGeneration(prev => ({
          ...prev,
          status: "failed",
          error: data.error
        }))
        return
      }

      setGeneration(prev => ({
        ...prev,
        status: "pending",
        taskId: data.taskId
      }))

      // Start polling for status
      pollTaskStatus(data.taskId)
    } catch {
      setGeneration(prev => ({
        ...prev,
        status: "failed",
        error: "Failed to start generation"
      }))
    }
  }

  const handleDownload = async () => {
    if (!generation.modelUrl) return
    
    try {
      const response = await fetch(generation.modelUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "avatar.glb"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      console.error("Failed to download model")
    }
  }

  const isGenerating = ["starting", "pending", "in_progress"].includes(generation.status)

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Custom Avatar Builder</h1>
        </div>
        <Button 
          onClick={handleDownload} 
          disabled={!generation.modelUrl} 
          variant="outline"
        >
          <Download className="mr-2 h-4 w-4" />
          Download GLB
        </Button>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid md:grid-cols-[360px_1fr] gap-8 h-[calc(100vh-73px)]">

        {/* Left panel: form */}
        <aside className="flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-8">

            {/* Step 1 - Photo */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <h2 className="text-base font-semibold">Upload Your Photo</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Meshy AI will generate a 3D model based on your photo.
              </p>

              <div className="flex bg-secondary p-1 rounded-lg">
                <button
                  onClick={() => setCaptureMode("upload")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${captureMode === "upload" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <UploadCloud className="h-4 w-4" /> Upload
                </button>
                <button
                  onClick={() => setCaptureMode("camera")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${captureMode === "camera" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Camera className="h-4 w-4" /> Camera
                </button>
              </div>

              {captureMode === "upload" ? (
                <Upload onUpload={handleInput} />
              ) : (
                <CameraCapture onCapture={handleInput} />
              )}
            </section>

            {/* Step 2 - Body */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <h2 className="text-base font-semibold">Body &amp; Clothing</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                These settings guide the AI texture generation.
              </p>
              <BodyCustomizer bodySettings={bodySettings} setBodySettings={setBodySettings} />
            </section>
          </div>

          {/* Generate button pinned to bottom */}
          <div className="p-4 border-t border-border bg-card">
            <Button
              className="w-full h-11 text-base font-semibold"
              onClick={handleGenerate}
              disabled={!headUrl || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating... {generation.progress}%
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-5 w-5" />
                  Generate 3D Avatar
                </>
              )}
            </Button>
            {!headUrl && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Upload a photo first to enable generation
              </p>
            )}
            {generation.status === "failed" && generation.error && (
              <p className="text-xs text-center text-destructive mt-2">
                {generation.error}
              </p>
            )}
          </div>
        </aside>

        {/* Right panel: canvas */}
        <section className="bg-secondary/30 rounded-2xl border border-border shadow-inner relative overflow-hidden">
          {generation.status === "succeeded" && generation.modelUrl ? (
            <Canvas camera={{ position: [0, 1, 3], fov: 50 }} shadows>
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
              <MeshyModel url={generation.modelUrl} />
              <Environment preset="city" />
              <OrbitControls target={[0, 0.8, 0]} minDistance={1} maxDistance={6} />
            </Canvas>
          ) : isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <div className="h-24 w-24 rounded-full border-4 border-secondary flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
                <div 
                  className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent"
                  style={{
                    transform: `rotate(${generation.progress * 3.6}deg)`,
                    transition: "transform 0.3s ease-out"
                  }}
                />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {generation.status === "starting" && "Starting generation..."}
                  {generation.status === "pending" && "Waiting in queue..."}
                  {generation.status === "in_progress" && `Generating... ${generation.progress}%`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  This may take a few minutes
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
                <Wand2 className="h-9 w-9 opacity-40" />
              </div>
              <p className="text-sm text-center px-8">
                Fill in your details and click <span className="font-semibold text-foreground">Generate 3D Avatar</span> to create your AI-powered 3D model
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
