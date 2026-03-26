"use client"

import { useRef, useEffect, Suspense, useState, useCallback, Component, ReactNode } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Html, Environment, ContactShadows } from "@react-three/drei"
import { Group, Mesh, MeshStandardMaterial, SphereGeometry, CylinderGeometry, BoxGeometry, Vector3, Color, CanvasTexture, SRGBColorSpace } from "three"
import { Button } from "@/components/ui/button"
import { CheckCircle2, RotateCcw, Play, User, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

class ErrorBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void; resetKey: number },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: (error: Error) => void; resetKey: number }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  componentDidUpdate(prevProps: { resetKey: number }) {
    if (prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

interface AvatarBodyProps {
  faceImageUrl?: string
  isAnimating?: boolean
}

// Simple humanoid body with head that can display the face texture
function AvatarBody({ faceImageUrl, isAnimating = false }: AvatarBodyProps) {
  const group = useRef<Group>(null)
  const headRef = useRef<Mesh>(null)
  const leftArmRef = useRef<Mesh>(null)
  const rightArmRef = useRef<Mesh>(null)
  const leftLegRef = useRef<Mesh>(null)
  const rightLegRef = useRef<Mesh>(null)
  const [faceTexture, setFaceTexture] = useState<CanvasTexture | null>(null)
  const timeRef = useRef(0)

  // Load face texture
  useEffect(() => {
    if (!faceImageUrl) return

    const img = new Image()
    if (!faceImageUrl.startsWith('data:')) {
      img.crossOrigin = "anonymous"
    }
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Create a sphere-friendly texture
      canvas.width = 512
      canvas.height = 512
      
      // Fill with skin color
      ctx.fillStyle = "#f5d0b5"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Draw face in the center, circular crop
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      
      // Create circular clip
      ctx.beginPath()
      ctx.arc(256, 256, 200, 0, Math.PI * 2)
      ctx.clip()
      
      ctx.drawImage(img, sx, sy, size, size, 56, 56, 400, 400)

      const tex = new CanvasTexture(canvas)
      tex.colorSpace = SRGBColorSpace
      setFaceTexture(tex)
    }
    img.src = faceImageUrl
  }, [faceImageUrl])

  // Animation
  useFrame((_, delta) => {
    if (!group.current) return
    
    // Gentle rotation
    group.current.rotation.y += delta * 0.3
    
    if (isAnimating) {
      timeRef.current += delta * 4
      const t = timeRef.current
      
      // Arm swing
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = Math.sin(t) * 0.5
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -Math.sin(t) * 0.5
      }
      
      // Leg swing
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = -Math.sin(t) * 0.4
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = Math.sin(t) * 0.4
      }
      
      // Subtle body bounce
      group.current.position.y = Math.abs(Math.sin(t * 2)) * 0.05
    }
  })

  const skinColor = new Color("#f5d0b5")
  const bodyColor = new Color("#3b82f6") // Blue shirt
  const pantsColor = new Color("#1e3a5f") // Dark blue pants
  const shoeColor = new Color("#333333")

  return (
    <group ref={group} position={[0, 0, 0]}>
      {/* Head */}
      <mesh ref={headRef} position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial 
          map={faceTexture || undefined}
          color={faceTexture ? undefined : skinColor}
        />
      </mesh>
      
      {/* Neck */}
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      
      {/* Torso */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.5, 0.65, 0.25]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      
      {/* Left Arm */}
      <group position={[-0.35, 1.1, 0]}>
        <mesh ref={leftArmRef} position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.06, 0.05, 0.5, 16]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
      </group>
      
      {/* Right Arm */}
      <group position={[0.35, 1.1, 0]}>
        <mesh ref={rightArmRef} position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.06, 0.05, 0.5, 16]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
      </group>
      
      {/* Hips */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.4, 0.2, 0.22]} />
        <meshStandardMaterial color={pantsColor} />
      </mesh>
      
      {/* Left Leg */}
      <group position={[-0.12, 0.3, 0]}>
        <mesh ref={leftLegRef} position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.08, 0.07, 0.6, 16]} />
          <meshStandardMaterial color={pantsColor} />
        </mesh>
        {/* Foot */}
        <mesh position={[0, -0.7, 0.03]}>
          <boxGeometry args={[0.1, 0.08, 0.18]} />
          <meshStandardMaterial color={shoeColor} />
        </mesh>
      </group>
      
      {/* Right Leg */}
      <group position={[0.12, 0.3, 0]}>
        <mesh ref={rightLegRef} position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.08, 0.07, 0.6, 16]} />
          <meshStandardMaterial color={pantsColor} />
        </mesh>
        {/* Foot */}
        <mesh position={[0, -0.7, 0.03]}>
          <boxGeometry args={[0.1, 0.08, 0.18]} />
          <meshStandardMaterial color={shoeColor} />
        </mesh>
      </group>
    </group>
  )
}

function Loader() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
        <p className="text-sm text-muted-foreground">Loading preview...</p>
      </div>
    </Html>
  )
}

interface AvatarPreviewWithBodyProps {
  faceImageUrl: string
  onConfirm: () => void
  onCancel: () => void
  isGenerating?: boolean
  className?: string
}

export function AvatarPreviewWithBody({
  faceImageUrl,
  onConfirm,
  onCancel,
  isGenerating = false,
  className,
}: AvatarPreviewWithBodyProps) {
  const [isAnimating, setIsAnimating] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const handleError = useCallback((err: Error) => {
    setError(err)
  }, [])

  const handleRetry = () => {
    setError(null)
    setRetryKey((prev) => prev + 1)
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8", className)}>
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <User className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="font-medium text-foreground mb-2">Preview failed to load</h3>
        <p className="text-sm text-muted-foreground mb-4">There was an issue rendering the preview.</p>
        <Button onClick={handleRetry} variant="outline" size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col rounded-2xl border border-border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/30">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-accent" />
          <h3 className="font-medium text-foreground">Avatar Preview</h3>
        </div>
        <button
          onClick={() => setIsAnimating(!isAnimating)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
            isAnimating 
              ? "bg-accent/10 text-accent" 
              : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          <Play className="h-3 w-3" />
          {isAnimating ? "Animating" : "Paused"}
        </button>
      </div>

      {/* 3D Preview Canvas */}
      <div className="relative aspect-square bg-gradient-to-b from-secondary/50 to-secondary/20">
        <ErrorBoundary onError={handleError} resetKey={retryKey}>
          <Canvas
            key={retryKey}
            camera={{ position: [0, 1, 3], fov: 40 }}
            shadows
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.7} />
            <directionalLight
              position={[5, 10, 5]}
              intensity={1}
              castShadow
              shadow-mapSize={[1024, 1024]}
            />
            <pointLight position={[-5, 5, -5]} intensity={0.4} />

            <Suspense fallback={<Loader />}>
              <AvatarBody faceImageUrl={faceImageUrl} isAnimating={isAnimating} />
              <ContactShadows
                position={[0, -0.35, 0]}
                opacity={0.4}
                scale={3}
                blur={2}
                far={2}
              />
            </Suspense>

            <Environment preset="studio" />
            <OrbitControls
              enablePan={false}
              minDistance={2}
              maxDistance={6}
              target={[0, 0.9, 0]}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 1.8}
            />
          </Canvas>
        </ErrorBoundary>

        {/* Generating overlay */}
        {isGenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="relative">
              <Sparkles className="h-12 w-12 animate-pulse text-accent" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              Generating 3D model...
            </p>
            <p className="text-xs text-muted-foreground">
              This may take a few minutes
            </p>
          </div>
        )}

        {/* Controls hint */}
        {!isGenerating && (
          <div className="absolute bottom-3 left-3 rounded-lg bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
            Drag to rotate | Scroll to zoom
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-3 bg-accent/5 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          This is a preview of how your face will appear on the avatar. The final 3D model will be generated using AI.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 p-4 border-t border-border">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isGenerating}
          className="flex-1"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Choose Different Photo
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isGenerating}
          className="flex-1"
        >
          {isGenerating ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
              Generating...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Generate Full 3D Model
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
