"use client"

// Main Page - Build: 2026-03-25-v5
import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { ImageUpload } from "@/components/image-upload"
import { ModelUpload } from "@/components/model-upload"
import { AnimationGenerator } from "@/components/animation-generator"
import { ProgressSteps } from "@/components/progress-steps"
import { RigGuideEditor, type RigGuidePoints } from "@/components/rig-guide-editor"
import { useMeshy } from "@/hooks/use-meshy"
import { Button } from "@/components/ui/button"
import { Sparkles, RotateCcw, Zap, Package, Play, Gamepad2, LogIn, UserPlus, LogOut, User } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { getSavableModelUrl, uploadModelUrlToStorage } from "@/lib/model-storage"

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
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null)
  const [uploadedModelUrl, setUploadedModelUrl] = useState<string | null>(null)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [savedModelUrl, setSavedModelUrl] = useState<string | null>(null)
  const [savedAnimationUrl, setSavedAnimationUrl] = useState<string | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [isUploadingModel, setIsUploadingModel] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploadedRigTaskId, setUploadedRigTaskId] = useState<string | null>(null)
  const [uploadedAnimationUrl, setUploadedAnimationUrl] = useState<string | null>(null)
  const [showRigGuideEditor, setShowRigGuideEditor] = useState(false)
  const [rigGuidePoints, setRigGuidePoints] = useState<RigGuidePoints>({})
  const lastGeneratedSyncKeyRef = useRef<string | null>(null)
  
  const {
    stage,
    currentStep,
    progress,
    modelUrl,
    animationUrl,
    rigTaskId,
    error,
    generateModel,
    reset,
  } = useMeshy()

  const loadSavedPlayerAssets = async (currentUser: SupabaseUser | null) => {
    if (!currentUser) {
      setSavedModelUrl(null)
      setSavedAnimationUrl(null)
      return
    }

    const supabase = createClient()
    const nickname = currentUser.email?.split("@")[0] || "Player"
    const { data: playerData } = await supabase
      .from("players")
      .select("model_url, animation_url")
      .eq("user_id", currentUser.id)
      .maybeSingle()

    if (playerData) {
      setSavedModelUrl(getSavableModelUrl(playerData.model_url || "") || playerData.model_url || null)
      setSavedAnimationUrl(getSavableModelUrl(playerData.animation_url || "") || playerData.animation_url || null)
      return
    }

    const { data: legacyPlayerData } = await supabase
      .from("players")
      .select("model_url, animation_url")
      .eq("nickname", nickname)
      .maybeSingle()

    setSavedModelUrl(getSavableModelUrl(legacyPlayerData?.model_url || "") || legacyPlayerData?.model_url || null)
    setSavedAnimationUrl(getSavableModelUrl(legacyPlayerData?.animation_url || "") || legacyPlayerData?.animation_url || null)
  }

  const findExistingPlayerRecord = async (supabase: ReturnType<typeof createClient>, currentUser: SupabaseUser) => {
    const nickname = currentUser.email?.split("@")[0] || "Player"
    const { data: playerByUserId, error: playerByUserIdError } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", currentUser.id)
      .maybeSingle()

    if (playerByUserIdError) {
      throw new Error(`Could not verify existing character record: ${playerByUserIdError.message}`)
    }

    if (playerByUserId) {
      return playerByUserId
    }

    const { data: legacyPlayer, error: legacyPlayerError } = await supabase
      .from("players")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle()

    if (legacyPlayerError) {
      throw new Error(`Could not verify existing character record: ${legacyPlayerError.message}`)
    }

    return legacyPlayer
  }

  // Check for logged in user and load their saved model
  useEffect(() => {
    const supabase = createClient()
    
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      await loadSavedPlayerAssets(user)
      setIsLoadingUser(false)
    }
    
    checkUser()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null)
      if (!session?.user) {
        setSavedModelUrl(null)
        setSavedAnimationUrl(null)
        lastGeneratedSyncKeyRef.current = null
      } else {
        await loadSavedPlayerAssets(session.user)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [])

  // Save generated model and walking animation to storage for multiplayer.
  useEffect(() => {
    const saveModel = async () => {
      if (stage === "complete" && modelUrl && user) {
        const syncKey = [user.id, modelUrl, animationUrl || "", rigTaskId || ""].join("|")
        if (lastGeneratedSyncKeyRef.current === syncKey) {
          return
        }

        setSaveError(null)
        setUploadError(null)
        setIsUploadingModel(true)
        const supabase = createClient()
        const nickname = user.email?.split("@")[0] || "Player"

        try {
          const storedModel = await uploadModelUrlToStorage({
            sourceUrl: modelUrl,
            supabase,
            userId: user.id,
            fileNameBase: "generated-model",
          })

          const storedAnimation = animationUrl
            ? await uploadModelUrlToStorage({
                sourceUrl: animationUrl,
                supabase,
                userId: user.id,
                fileNameBase: "generated-walking-animation",
              })
            : null

          const payload = {
            nickname,
            user_id: user.id,
            model_url: storedModel.publicUrl,
            animation_url: storedAnimation?.publicUrl || null,
            rig_task_id: rigTaskId,
            updated_at: new Date().toISOString(),
          }

          const existingPlayer = await findExistingPlayerRecord(supabase, user)

          if (existingPlayer) {
            const { error: updateError } = await supabase
              .from("players")
              .update(payload)
              .eq("id", existingPlayer.id)

            if (updateError) {
              setSaveError(`Failed to save character: ${updateError.message}`)
              return
            }
          } else {
            const { error: insertError } = await supabase
              .from("players")
              .insert(payload)

            if (insertError) {
              setSaveError(`Failed to save character: ${insertError.message}`)
              return
            }
          }

          lastGeneratedSyncKeyRef.current = syncKey
          setSavedModelUrl(storedModel.savableUrl)
          setSavedAnimationUrl(storedAnimation?.savableUrl || null)
        } catch (storageError) {
          console.error("[v0] Generated model storage sync failed:", storageError)
          const message = storageError instanceof Error ? storageError.message : "Failed to save generated model to storage"
          setUploadError(message)
          setSaveError(message)
        } finally {
          setIsUploadingModel(false)
        }
      }
    }
    
    saveModel()
  }, [stage, modelUrl, animationUrl, rigTaskId, user])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setSavedModelUrl(null)
    setSavedAnimationUrl(null)
    lastGeneratedSyncKeyRef.current = null
  }

  const handleImageSelect = (dataUrl: string) => {
    setSelectedImage(dataUrl)
    setRigGuidePoints({})
  }

  const handleGenerate = async () => {
    if (selectedImage) {
      await generateModel(selectedImage, { rigGuidePoints })
    }
  }

  const handleReset = () => {
    setSelectedImage(null)
    setUploadedPreviewUrl(null)
    setUploadedModelUrl(null)
    setUploadedRigTaskId(null)
    setUploadedAnimationUrl(null)
    setUploadError(null)
    setSaveError(null)
    setShowRigGuideEditor(false)
    setRigGuidePoints({})
    lastGeneratedSyncKeyRef.current = null
    reset()
  }

  const pollUploadedRiggingTask = async (taskId: string) => {
    const maxAttempts = 120
    let attempts = 0

    while (attempts < maxAttempts) {
      const response = await fetch(`/api/meshy/rigging/${taskId}`)
      if (!response.ok) throw new Error("Failed to fetch rigging task status")

      const task = await response.json()

      if (task.status === "SUCCEEDED") {
        return task
      }

      if (task.status === "FAILED" || task.status === "CANCELED") {
        throw new Error(task.error || "Rigging task failed")
      }

      await new Promise((resolve) => setTimeout(resolve, 5000))
      attempts++
    }

    throw new Error("Rigging task timed out")
  }

  const startRiggingForUploadedModel = async (url: string) => {
    try {
      const riggingResponse = await fetch("/api/meshy/rigging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelUrl: url }),
      })

      if (!riggingResponse.ok) {
        const errorData = await riggingResponse.json().catch(() => null)
        throw new Error(errorData?.error || "Failed to start rigging")
      }

      const riggingData = await riggingResponse.json()
      if (!riggingData.taskId) {
        throw new Error("Rigging did not return a task ID")
      }

      setUploadedRigTaskId(riggingData.taskId)

      if (user) {
        const supabase = createClient()
        const existingPlayer = await findExistingPlayerRecord(supabase, user)

        if (existingPlayer) {
          const { error: updateError } = await supabase
            .from("players")
            .update({
              rig_task_id: riggingData.taskId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPlayer.id)

          if (updateError) {
            throw new Error(`Failed to save rigging task: ${updateError.message}`)
          }
        }
      }

      const riggingTask = await pollUploadedRiggingTask(riggingData.taskId)
      if (riggingTask.result?.basic_animations?.walking_glb_url) {
        setUploadedAnimationUrl(riggingTask.result.basic_animations.walking_glb_url)
      } else if (riggingTask.result?.rigged_character_glb_url) {
        setUploadedAnimationUrl(riggingTask.result.rigged_character_glb_url)
      }
    } catch (riggingError) {
      console.warn("[v0] Uploaded model rigging failed:", riggingError)
      setUploadError(riggingError instanceof Error ? riggingError.message : "Rigging failed for uploaded model")
    }
  }

  const handleModelUpload = async (file: File, localUrl: string) => {
    setUploadedPreviewUrl(localUrl)
    setUploadedModelUrl(null)
    setUploadedRigTaskId(null)
    setUploadedAnimationUrl(null)
    setUploadError(null)
    setSaveError(null)

    if (!user) {
      setUploadError("Log in to upload your model to storage before joining the multiplayer world.")
      return
    }

    setIsUploadingModel(true)

    try {
      const supabase = createClient()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const filePath = `${user.id}/${Date.now()}-${safeName}`

      const candidateBuckets = ["models", "model_uploads", "uploads"]
      let uploadedBucket: string | null = null
      let lastUploadError: string | null = null

      for (const bucket of candidateBuckets) {
        const { error: uploadStorageError } = await supabase
          .storage
          .from(bucket)
          .upload(filePath, file, {
            upsert: false,
            contentType: file.type || "model/gltf-binary",
          })

        if (!uploadStorageError) {
          uploadedBucket = bucket
          break
        }

        lastUploadError = uploadStorageError.message
        const bucketMissing = uploadStorageError.message.toLowerCase().includes("bucket not found")
        if (!bucketMissing) {
          throw new Error(`Failed to upload model: ${uploadStorageError.message}`)
        }
      }

      if (!uploadedBucket) {
        throw new Error(
          `Failed to upload model: ${lastUploadError || "No compatible storage bucket found"}. Create a public bucket named \"models\" (or \"model_uploads\").`
        )
      }

      const { data: publicData } = supabase.storage.from(uploadedBucket).getPublicUrl(filePath)
      const publicUrl = publicData.publicUrl
      const savablePublicUrl = getSavableModelUrl(publicUrl)
      if (!savablePublicUrl) {
        throw new Error("Failed to prepare uploaded model URL for saving.")
      }
      setUploadedModelUrl(savablePublicUrl)

      const payload = {
        nickname: user.email?.split("@")[0] || "Player",
        user_id: user.id,
        model_url: publicUrl,
        updated_at: new Date().toISOString(),
      }

      const existingPlayer = await findExistingPlayerRecord(supabase, user)

      if (existingPlayer) {
        const { error: updateError } = await supabase
          .from("players")
          .update(payload)
          .eq("id", existingPlayer.id)

        if (updateError) {
          throw new Error(`Failed to update saved character: ${updateError.message}`)
        }
      } else {
        const { error: insertError } = await supabase
          .from("players")
          .insert(payload)

        if (insertError) {
          throw new Error(`Failed to save character: ${insertError.message}`)
        }
      }

      setSavedModelUrl(payload.model_url)
      setSavedAnimationUrl(null)

      await startRiggingForUploadedModel(publicUrl)
    } catch (uploadErr) {
      console.error("[v0] Model upload failed:", uploadErr)
      const message = uploadErr instanceof Error ? uploadErr.message : "Failed to upload model"
      setUploadError(message)
      setSaveError(message)
    } finally {
      setIsUploadingModel(false)
    }
  }

  const isProcessing = stage === "generating" || stage === "rigging" || stage === "uploading" || isUploadingModel
  const showModel = (stage === "complete" && modelUrl) || uploadedPreviewUrl || uploadedModelUrl
  const displayModelUrl = uploadedPreviewUrl || uploadedModelUrl || modelUrl
  const displayAnimationUrl = uploadedModelUrl ? uploadedAnimationUrl : animationUrl
  const displayRigTaskId = uploadedModelUrl ? uploadedRigTaskId : rigTaskId
  const multiplayerModelUrl =
    uploadedAnimationUrl ||
    uploadedModelUrl ||
    savedAnimationUrl ||
    savedModelUrl ||
    getSavableModelUrl(modelUrl || "")

  const renderMultiplayerCta = () => {
    if (!multiplayerModelUrl) return null

    if (user) {
      return (
        <div className="flex flex-col items-center gap-4 mt-6">
          {isUploadingModel && (
            <p className="text-sm text-muted-foreground">Uploading model to storage before multiplayer...</p>
          )}
          {multiplayerModelUrl && !isUploadingModel && <p className="text-sm text-green-600">Model saved to your account!</p>}
          <Link href={`/world?modelUrl=${encodeURIComponent(multiplayerModelUrl)}`}>
            <Button
              size="lg"
              className="h-12 px-8 text-base font-semibold bg-green-600 hover:bg-green-700"
              disabled={isUploadingModel || Boolean(uploadedPreviewUrl && !uploadedModelUrl)}
            >
              <Gamepad2 className="mr-2 h-5 w-5" />
              Join Multiplayer World
            </Button>
          </Link>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-4 mt-6">
        <div className="rounded-xl border border-border bg-card p-6 text-center max-w-md">
          <h3 className="font-semibold text-foreground mb-2">Save & Play Multiplayer</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Sign up to save your character and join the multiplayer world with other players.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/auth/login">
              <Button variant="outline">
                <LogIn className="mr-2 h-4 w-4" />
                Log In
              </Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="relative overflow-hidden border-b border-border bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        
        {/* Auth header */}
        <div className="relative mx-auto max-w-6xl px-4 pt-4">
          <div className="flex justify-end items-center gap-3">
            {isLoadingUser ? (
              <div className="h-8 w-20 animate-pulse bg-muted rounded" />
            ) : user ? (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
                {(savedAnimationUrl || savedModelUrl) && (
                  <Link href={`/world?modelUrl=${encodeURIComponent(savedAnimationUrl || savedModelUrl || "")}`}>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      <Gamepad2 className="mr-2 h-4 w-4" />
                      Enter Multiplayer
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
                  <Button size="sm" variant="ghost">
                    <LogIn className="mr-2 h-4 w-4" />
                    Log In
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Sign Up
                  </Button>
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

              {selectedImage && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={showRigGuideEditor}
                      onChange={(e) => setShowRigGuideEditor(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Enable rigging guide preview and joint placement
                  </label>

                  {showRigGuideEditor && (
                    <RigGuideEditor
                      imageUrl={selectedImage}
                      points={rigGuidePoints}
                      onChange={setRigGuidePoints}
                    />
                  )}
                </div>
              )}

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

              {/* Model Upload for Testing */}
              <div className="pt-4 border-t border-border">
                <ModelUpload
                  onModelSelect={handleModelUpload}
                  disabled={isProcessing}
                />
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
                  {displayAnimationUrl 
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
              <ModelViewer modelUrl={displayModelUrl!} animationUrl={displayAnimationUrl || undefined} />
            </div>

            {uploadedPreviewUrl && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-blue-500/10 p-3 text-sm text-blue-600 mt-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <strong>Uploaded model loaded:</strong> Preview is ready{uploadedModelUrl ? " and the hosted copy is ready for multiplayer." : "."}
                </div>
                {user && isUploadingModel && !uploadedModelUrl && (
                  <p className="text-xs">Uploading to storage now. Multiplayer unlocks as soon as the hosted copy finishes saving.</p>
                )}
                {user && !isUploadingModel && !uploadedModelUrl && !uploadError && (
                  <p className="text-xs">The hosted copy is not ready yet. Try uploading again if this does not update.</p>
                )}
                {user && uploadedModelUrl && (
                  <p className="text-xs">Hosted copy saved successfully. You can use this model in multiplayer now.</p>
                )}
                {!user && <p className="text-xs">Log in to save this uploaded model and generate animations.</p>}
              </div>
            )}

            {uploadedModelUrl && uploadedRigTaskId && user && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 text-center">
                Rigging saved to your player profile. Generate animations below to save them to your account.
              </div>
            )}

            {displayAnimationUrl && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-accent/10 p-3 text-sm text-accent mt-4">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  <strong>Walking animation included!</strong> Your character comes with a walking animation.
                </div>
              </div>
            )}

            {uploadError && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
                {uploadError}
              </div>
            )}

            {saveError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {saveError}
              </div>
            )}

            {/* Animation Generation Section - shown after model is ready */}
            {displayModelUrl && displayRigTaskId && user && (
              <AnimationGenerator rigTaskId={displayRigTaskId} userId={user.id} />
            )}

            {renderMultiplayerCta()}

          </div>
        )}
      </div>

      <footer className="border-t border-border bg-card py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground" />
      </footer>
    </main>
  )
}
