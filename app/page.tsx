"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { useMeshy } from "@/hooks/use-meshy"
import { Button } from "@/components/ui/button"
import { Sparkles, RotateCcw, Zap, Package, Play, Gamepad2 } from "lucide-react"
import { ImageUpload } from "@/components/image-upload"
import { ProgressSteps } from "@/components/progress-steps"

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

const CoffeeShopGame = dynamic(
  () => import("@/components/coffee-shop-game").then((mod) => mod.CoffeeShopGame),
  { 
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading coffee shop...</p>
        </div>
      </div>
    ),
  }
)

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [gameMode, setGameMode] = useState(false)
  const {
    modelUrl,
    animationUrl,
    loading,
    error,
    generateModel,
    startRigging,
    reset,
  } = useMeshy()

  const handleImageSelect = (file: File) => {
    setSelectedImage(URL.createObjectURL(file))
    generateModel(file)
  }

  const handleReset = () => {
    setSelectedImage(null)
    setGameMode(false)
    reset()
  }

  const handleGenerateAnimation = () => {
    if (modelUrl) {
      startRigging(modelUrl)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
            <Sparkles className="h-4 w-4" />
            AI-Powered 3D Character Generator
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Model Walker
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">
            Upload a photo and watch it come to life as a walking 3D character. Explore a virtual coffee shop with your creation.
          </p>
        </div>

        {!selectedImage ? (
          <div className="mb-12">
            <ImageUpload 
              onImageSelect={handleImageSelect} 
              onGenerate={handleGenerateAnimation}
              disabled={loading}
              showGenerateButton={true}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <ProgressSteps 
              steps={[
                { id: "upload", label: "Image Uploaded" },
                { id: "model", label: "3D Model" },
                { id: "animation", label: "Animation" },
              ]}
              currentStep={animationUrl ? 3 : modelUrl ? 2 : loading ? 1 : 0}
              error={error || undefined}
            />

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                <p className="font-medium">Error: {error}</p>
              </div>
            )}

            {modelUrl && !animationUrl && !error && (
              <div className="flex justify-center">
                <Button 
                  onClick={handleGenerateAnimation}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Generating Animation...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Generate Walking Animation
                    </>
                  )}
                </Button>
              </div>
            )}

            {modelUrl && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {gameMode ? "Coffee Shop Explorer" : "Your 3D Character"}
                    </h2>
                    <p className="text-muted-foreground">
                      {gameMode 
                        ? "Use WASD or Arrow Keys to walk around the coffee shop!"
                        : animationUrl 
                          ? "Your character is ready! Enter the coffee shop to explore."
                          : "Your textured 3D model is ready. Drag to rotate, scroll to zoom."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {animationUrl && (
                      <Button 
                        onClick={() => setGameMode(!gameMode)} 
                        variant={gameMode ? "default" : "outline"}
                      >
                        <Gamepad2 className="mr-2 h-4 w-4" />
                        {gameMode ? "Exit Game" : "Enter Coffee Shop"}
                      </Button>
                    )}
                    <Button onClick={handleReset} variant="outline">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Create Another
                    </Button>
                  </div>
                </div>

                <div className={gameMode ? "h-[600px] overflow-hidden rounded-2xl border border-border shadow-xl" : "aspect-[4/3] overflow-hidden rounded-2xl border border-border shadow-xl"}>
                  {gameMode ? (
                    <CoffeeShopGame modelUrl={modelUrl} animationUrl={animationUrl || undefined} />
                  ) : (
                    <ModelViewer modelUrl={modelUrl} animationUrl={animationUrl || undefined} />
                  )}
                </div>

                {animationUrl && !gameMode && (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-accent/10 p-3 text-sm text-accent">
                    <Gamepad2 className="h-4 w-4" />
                    Click "Enter Coffee Shop" to walk around with your character!
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-20 grid grid-cols-3 gap-8 border-t border-border/50 pt-12">
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <Package className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Generate 3D Model</h3>
            <p className="mt-1 text-sm text-muted-foreground">Upload a photo to create a textured 3D model</p>
          </div>
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <Play className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Add Walking Animation</h3>
            <p className="mt-1 text-sm text-muted-foreground">Rig the character with walking animations</p>
          </div>
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <Gamepad2 className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Explore Coffee Shop</h3>
            <p className="mt-1 text-sm text-muted-foreground">Walk around a 3D coffee shop environment</p>
          </div>
        </div>
      </div>
    </main>
  )
}
