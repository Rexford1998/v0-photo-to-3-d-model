"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { ImageUpload } from "@/components/image-upload"
import { ProgressSteps } from "@/components/progress-steps"
import { useMeshy } from "@/hooks/use-meshy"
import { Button } from "@/components/ui/button"
import { Sparkles, RotateCcw, Zap, Box, PersonStanding } from "lucide-react"

const ModelViewer = dynamic(
  () => import("@/components/model-viewer").then((mod) => mod.ModelViewer),
  { 
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading 3D viewer...</p>
        </div>
      </div>
    ),
  }
)

const STEPS = [
  { id: "generate", label: "Generate 3D", description: "Creating model" },
  { id: "rig", label: "Add Animation", description: "Rigging character" },
  { id: "complete", label: "Ready", description: "View your model" },
]

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const {
    stage,
    currentStep,
    progress,
    modelUrl,
    animationUrl,
    error,
    generateModel,
    reset,
  } = useMeshy()

  const handleImageSelect = (dataUrl: string) => {
    setSelectedImage(dataUrl)
  }

  const handleGenerate = async () => {
    if (selectedImage) {
      await generateModel(selectedImage)
    }
  }

  const handleReset = () => {
    setSelectedImage(null)
    reset()
  }

  const isProcessing = stage === "generating" || stage === "rigging" || stage === "uploading"
  const showModel = stage === "complete" && modelUrl

  return (
    <main className="min-h-screen bg-background">
      <header className="relative overflow-hidden border-b border-border bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
              <Sparkles className="h-4 w-4" />
              Powered by Meshy AI
            </div>
            <h1 className="mb-4 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Bring Your Photos to Life
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Upload a character image and watch it transform into an animated 3D model with walking capabilities
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        {!showModel ? (
          <div className="mx-auto max-w-2xl space-y-8">
            <div className="space-y-4">
              <ImageUpload
                onImageSelect={handleImageSelect}
                disabled={isProcessing}
              />

              <div className="flex gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={!selectedImage || isProcessing}
                  className="flex-1 h-12 text-base font-medium"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Generate Walking Model
                    </>
                  )}
                </Button>

                {selectedImage && !isProcessing && (
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="lg"
                    className="h-12"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {isProcessing && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <ProgressSteps
                  steps={STEPS}
                  currentStep={currentStep}
                  progress={progress}
                  error={error || undefined}
                />
              </div>
            )}

            {stage === "error" && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
                <p className="mb-4 text-destructive">{error}</p>
                <Button onClick={handleReset} variant="outline">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-card p-4 text-center border border-border">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                  <Box className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-medium text-foreground">3D Generation</h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered image to 3D model conversion
                </p>
              </div>
              <div className="rounded-xl bg-card p-4 text-center border border-border">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                  <PersonStanding className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-medium text-foreground">Auto Animation</h3>
                <p className="text-sm text-muted-foreground">
                  Automatic rigging with walking animation
                </p>
              </div>
              <div className="rounded-xl bg-card p-4 text-center border border-border">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                  <Sparkles className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-medium text-foreground">Interactive View</h3>
                <p className="text-sm text-muted-foreground">
                  Rotate and zoom your 3D character
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Your 3D Character</h2>
                <p className="text-muted-foreground">
                  {animationUrl 
                    ? "Your character is now walking! Interact with the 3D view below."
                    : "Your 3D model is ready. Drag to rotate, scroll to zoom."}
                </p>
              </div>
              <Button onClick={handleReset} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Create Another
              </Button>
            </div>

            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border shadow-xl">
              <ModelViewer modelUrl={modelUrl} animationUrl={animationUrl || undefined} />
            </div>

            {animationUrl && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-accent/10 p-3 text-sm text-accent">
                <PersonStanding className="h-4 w-4" />
                Walking animation active
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="border-t border-border bg-card py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          <p>
            3D models generated using Meshy AI. Works best with humanoid characters.
          </p>
        </div>
      </footer>
    </main>
  )
}
