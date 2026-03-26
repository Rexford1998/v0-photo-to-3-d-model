"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Camera, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CameraCapture({ onCapture }: { onCapture: (url: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      setError("Unable to access camera. Please check permissions.")
      console.error(err)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }, [stream])

  useEffect(() => {
    startCamera()
    return stopCamera
  }, [startCamera, stopCamera])

  const takeSnapshot = () => {
    if (!videoRef.current) return

    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Flip the context horizontally so the captured image matches the mirrored video preview
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)

    // Draw the current video frame
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

    // Convert to data url
    const dataUrl = canvas.toDataURL("image/jpeg")
    onCapture(dataUrl)
  }

  if (error) {
    return (
      <div className="relative border-2 border-dashed border-destructive/50 rounded-xl p-6 text-center text-destructive bg-destructive/5">
        <p className="text-sm font-medium mb-4">{error}</p>
        <Button variant="outline" onClick={startCamera}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] flex flex-col">
      {/* Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover mirror-x"
        style={{ transform: "scaleX(-1)" }} // mirror for selfie view
      />

      {/* Oval Overlay Guide */}
      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div className="w-[60%] h-[50%] rounded-[100%] border-4 border-white/50 border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
      </div>

      {/* Helper Text */}
      <div className="absolute top-4 inset-x-0 z-20 text-center">
        <p className="text-white text-sm font-medium drop-shadow-md bg-black/40 inline-block px-3 py-1 rounded-full">
          Align your face in the oval
        </p>
      </div>

      {/* Capture Controls */}
      <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center">
        <button
          onClick={takeSnapshot}
          className="h-16 w-16 rounded-full bg-white/30 border-4 border-white flex items-center justify-center hover:bg-white/50 transition-colors"
          aria-label="Take Photo"
        >
          <div className="h-12 w-12 rounded-full bg-white" />
        </button>
      </div>
    </div>
  )
}
