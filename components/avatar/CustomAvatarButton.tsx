"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  User,
  Upload,
  Camera,
  ImageIcon,
  X,
  CheckCircle2,
  RefreshCw,
  Scan,
  AlertCircle,
} from "lucide-react"
import Image from "next/image"

interface FaceDetectionResult {
  detected: boolean
  confidence: number
  landmarks?: { x: number; y: number; z: number }[]
  boundingBox?: { x: number; y: number; width: number; height: number }
}

interface CustomAvatarButtonProps {
  onAvatarSelect: (imageData: string, faceData?: FaceDetectionResult) => void
  className?: string
  disabled?: boolean
}

export function CustomAvatarButton({
  onAvatarSelect,
  className,
  disabled,
}: CustomAvatarButtonProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"upload" | "camera">("upload")
  const [preview, setPreview] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [faceResult, setFaceResult] = useState<FaceDetectionResult | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Clean up camera stream when dialog closes or tab changes
  useEffect(() => {
    if (!open || activeTab !== "camera") {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
        setCameraStream(null)
      }
    }
  }, [open, activeTab, cameraStream])

  // Start camera when camera tab is active
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error("Camera access error:", err)
      setCameraError("Unable to access camera. Please check permissions.")
    }
  }, [])

  useEffect(() => {
    if (open && activeTab === "camera" && !cameraStream && !cameraError) {
      startCamera()
    }
  }, [open, activeTab, cameraStream, cameraError, startCamera])

  // Handle file upload
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result as string
        setPreview(dataUrl)
        setFaceResult(null)
        // Auto-scan face after upload
        await scanFace(dataUrl)
      }
      reader.readAsDataURL(file)
    },
    []
  )

  // Handle drag and drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith("image/")) return

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setPreview(dataUrl)
      setFaceResult(null)
      await scanFace(dataUrl)
    }
    reader.readAsDataURL(file)
  }, [])

  // Take snapshot from camera
  const takeSnapshot = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Mirror the image for selfie camera
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
    setPreview(dataUrl)
    setFaceResult(null)
    
    // Stop camera after taking photo
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
    
    // Auto-scan the captured face
    await scanFace(dataUrl)
  }, [cameraStream])

  // Scan face using API-based detection
  const scanFace = async (imageData: string): Promise<void> => {
    setIsScanning(true)
    
    try {
      const response = await fetch("/api/face-detect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageData }),
      })

      if (!response.ok) {
        throw new Error("Face detection failed")
      }

      const result = await response.json()
      
      setFaceResult({
        detected: result.detected,
        confidence: result.confidence,
        landmarks: result.landmarks,
        boundingBox: result.boundingBox,
      })
    } catch (error) {
      console.error("Face scan error:", error)
      setFaceResult({
        detected: false,
        confidence: 0,
      })
    } finally {
      setIsScanning(false)
    }
  }

  // Confirm selection
  const handleConfirm = () => {
    if (preview) {
      onAvatarSelect(preview, faceResult || undefined)
      handleReset()
      setOpen(false)
    }
  }

  // Reset state
  const handleReset = () => {
    setPreview(null)
    setFaceResult(null)
    setIsScanning(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2 border-dashed border-2 hover:border-accent hover:bg-accent/5 transition-all",
            className
          )}
          disabled={disabled}
        >
          <User className="h-4 w-4" />
          Custom Avatar
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-accent" />
            Create Custom Avatar
          </DialogTitle>
          <DialogDescription>
            Upload a face photo or use your camera for a personalized 3D avatar
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "upload" | "camera")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Photo
            </TabsTrigger>
            <TabsTrigger value="camera" className="gap-2">
              <Camera className="h-4 w-4" />
              Use Camera
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="mt-4">
            {!preview ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/30 transition-all hover:border-accent hover:bg-secondary/50"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className="rounded-full bg-accent/10 p-4">
                    <ImageIcon className="h-8 w-8 text-accent" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      Drop your face photo here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse (JPG, PNG)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <PreviewSection
                preview={preview}
                isScanning={isScanning}
                faceResult={faceResult}
                onReset={handleReset}
                onRescan={() => scanFace(preview)}
                onConfirm={handleConfirm}
              />
            )}
          </TabsContent>

          {/* Camera Tab */}
          <TabsContent value="camera" className="mt-4">
            {!preview ? (
              <div className="relative overflow-hidden rounded-xl bg-foreground/5">
                {cameraError ? (
                  <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-6 text-center">
                    <div className="rounded-full bg-destructive/10 p-4">
                      <AlertCircle className="h-8 w-8 text-destructive" />
                    </div>
                    <p className="text-sm text-destructive">{cameraError}</p>
                    <Button variant="outline" onClick={startCamera} size="sm">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div className="relative aspect-[3/4]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />

                    {/* Face guide overlay */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-[55%] w-[60%] rounded-[100%] border-4 border-dashed border-accent/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
                    </div>

                    {/* Instructions */}
                    <div className="absolute inset-x-0 top-4 z-10 text-center">
                      <p className="inline-block rounded-full bg-foreground/80 px-4 py-1.5 text-sm font-medium text-background">
                        Align your face in the oval
                      </p>
                    </div>

                    {/* Capture button */}
                    <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center">
                      <button
                        onClick={takeSnapshot}
                        className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-background bg-background/30 transition-all hover:bg-background/50 active:scale-95"
                        aria-label="Take Photo"
                      >
                        <div className="h-12 w-12 rounded-full bg-background" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <PreviewSection
                preview={preview}
                isScanning={isScanning}
                faceResult={faceResult}
                onReset={() => {
                  handleReset()
                  startCamera()
                }}
                onRescan={() => scanFace(preview)}
                onConfirm={handleConfirm}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Hidden canvas for image processing */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  )
}

// Preview section component
function PreviewSection({
  preview,
  isScanning,
  faceResult,
  onReset,
  onRescan,
  onConfirm,
}: {
  preview: string
  isScanning: boolean
  faceResult: FaceDetectionResult | null
  onReset: () => void
  onRescan: () => void
  onConfirm: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl">
        <div className="relative aspect-square">
          <Image
            src={preview}
            alt="Face preview"
            fill
            className="object-cover"
          />

          {/* Scanning overlay */}
          {isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="relative">
                <Scan className="h-12 w-12 animate-pulse text-accent" />
                <div className="absolute inset-0 animate-ping">
                  <Scan className="h-12 w-12 text-accent/30" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                Scanning face...
              </p>
              <p className="text-xs text-muted-foreground">
                Analyzing facial features for better 3D model
              </p>
            </div>
          )}

          {/* Clear button */}
          <button
            onClick={onReset}
            className="absolute right-3 top-3 rounded-full bg-background/90 p-2 text-muted-foreground shadow-lg transition-colors hover:bg-destructive hover:text-destructive-foreground"
            disabled={isScanning}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Face detection result */}
      {faceResult && !isScanning && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg p-3",
            faceResult.detected
              ? "bg-accent/10 text-accent"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {faceResult.detected ? (
            <>
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Face detected</p>
                <p className="text-xs opacity-80">
                  Confidence: {Math.round(faceResult.confidence * 100)}%
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">No face detected</p>
                <p className="text-xs opacity-80">
                  Try a clearer front-facing photo
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onRescan}
          disabled={isScanning}
          className="flex-1"
        >
          <Scan className="mr-2 h-4 w-4" />
          Rescan
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isScanning || !faceResult?.detected}
          className="flex-1"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Use This Photo
        </Button>
      </div>
    </div>
  )
}
