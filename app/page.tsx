"use client"

// Main Page - Build: 2026-03-25-v5
import { useState, useEffect, Suspense } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { ImageUpload } from "@/components/image-upload"
import { ProgressSteps } from "@/components/progress-steps"
import { useMeshy } from "@/hooks/use-meshy"
import { Button } from "@/components/ui/button"
import { Sparkles, RotateCcw, Zap, Package, Play, Gamepad2, LogIn, UserPlus, User, LogOut } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

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

function HomeContent() {
  const searchParams = useSearchParams()
  const urlModelUrl = searchParams.get("modelUrl")
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [savedCharacter, setSavedCharacter] = useState<{ model_url: string; nickname: string | null } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [restoredModelUrl, setRestoredModelUrl] = useState<string | null>(null)
  
  const {
    stage,
    currentStep,
    progress,
    modelUrl: generatedModelUrl,
    animationUrl,
    error,
    generateModel,
    reset,
  } = useMeshy()
  
  // Use restored URL from query param or generated model
  const modelUrl = restoredModelUrl || generatedModelUrl
  
  // Restore model from URL parameter (after login redirect)
  useEffect(() => {
    if (urlModelUrl) {
      setRestoredModelUrl(urlModelUrl)
    }
  }, [urlModelUrl])

  // Check for logged in user and load saved character
  useEffect(() => {
    const supabase = createClient()
    
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // Load saved character
        const { data } = await supabase
          .from('user_characters')
          .select('model_url, nickname')
          .eq('user_id', user.id)
          .single()
        
        if (data) {
          setSavedCharacter(data)
        }
      }
    }
    
    checkUser()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null)
      if (session?.user) {
        const { data } = await supabase
          .from('user_characters')
          .select('model_url, nickname')
          .eq('user_id', session.user.id)
          .single()
        setSavedCharacter(data || null)
      } else {
        setSavedCharacter(null)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [])

  // Save character when model is generated and user is logged in
  const saveCharacter = async () => {
    if (!user || !modelUrl) return
    
    setIsSaving(true)
    const supabase = createClient()
    
    const { error } = await supabase
      .from('user_characters')
      .upsert({
        user_id: user.id,
        model_url: modelUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
    
    if (!error) {
      setSavedCharacter({ model_url: modelUrl, nickname: null })
    }
    setIsSaving(false)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setSavedCharacter(null)
  }

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
  const showModel = (stage === "complete" && modelUrl) || restoredModelUrl

  return (
    <main className="min-h-screen bg-background">
      <header className="relative overflow-hidden border-b border-border bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        
        {/* Auth header bar */}
        <div className="relative mx-auto max-w-6xl px-4 pt-4">
          <div className="flex justify-end items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">{user.email}</span>
                {savedCharacter && (
                  <Link href={`/world?modelUrl=${encodeURIComponent(savedCharacter.model_url)}`}>
                    <Button size="sm" variant="outline">
                      <Gamepad2 className="mr-2 h-4 w-4" />
                      Play with Saved Character
                    </Button>
                  </Link>
                )}
                <Button size="sm" variant="ghost" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button size="sm" variant="ghost">Log In</Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
        
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
              Upload a character image and watch it transform into an animated 3D model with textures and walking capabilities
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
                  <Package className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-medium text-foreground">3D Generation</h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered image to 3D model with textures
                </p>
              </div>
              <div className="rounded-xl bg-card p-4 text-center border border-border">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                  <Play className="h-6 w-6 text-foreground" />
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
                  Rotate and zoom with textured details
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
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-accent/10 p-3 text-sm text-accent mt-4">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  <strong>Walking mode active:</strong> Click inside the 3D viewer, then use WASD to move and Mouse to look around.
                </div>
              </div>
            )}

            {modelUrl && (
              <div className="flex flex-col items-center gap-4 mt-6">
                {/* Auth section */}
                {!user ? (
                  <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4">
                    <div className="text-center">
                      <h3 className="font-semibold text-foreground">Join Multiplayer World</h3>
                      <p className="text-sm text-muted-foreground">Sign up or log in to join the multiplayer world with your character</p>
                    </div>
                    <div className="flex gap-3">
                      <Link href={`/auth/login?returnTo=${encodeURIComponent("/?modelUrl=" + encodeURIComponent(modelUrl))}`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          <LogIn className="mr-2 h-4 w-4" />
                          Log In
                        </Button>
                      </Link>
                      <Link href={`/auth/sign-up?returnTo=${encodeURIComponent("/?modelUrl=" + encodeURIComponent(modelUrl))}`} className="flex-1">
                        <Button className="w-full">
                          <UserPlus className="mr-2 h-4 w-4" />
                          Sign Up
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {savedCharacter?.model_url === modelUrl ? (
                      <p className="text-center text-sm text-green-600">Character saved!</p>
                    ) : (
                      <Button onClick={saveCharacter} disabled={isSaving} className="w-full">
                        {isSaving ? "Saving..." : "Save Character"}
                      </Button>
                    )}
                    
                    <Link href={`/world?modelUrl=${encodeURIComponent(modelUrl)}`} className="block">
                      <Button size="lg" className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700">
                        <Gamepad2 className="mr-2 h-5 w-5" />
                        Join Multiplayer World
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="border-t border-border bg-card py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          <p>Transform your photos into animated 3D characters</p>
        </div>
      </footer>
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
