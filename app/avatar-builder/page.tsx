"use client"

import { useState } from "react"
import AvatarCanvas from "@/components/avatar/AvatarCanvas"
import { Upload } from "@/components/avatar/Upload"
import { CameraCapture } from "@/components/avatar/CameraCapture"
import Sliders from "@/components/avatar/Sliders"
import { useAvatar } from "@/hooks/useAvatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Download, Camera, UploadCloud } from "lucide-react"

export default function AvatarBuilderPage() {
  const { headUrl, setHeadUrl, morphs, setMorphs } = useAvatar()
  const [isExporting, setIsExporting] = useState(false)
  const [mode, setMode] = useState<"upload" | "camera">("upload")

  const handleInput = async (url: string) => {
    setHeadUrl(url)

    // Auto-map face landmarks via mock API if an image is provided
    if (url.startsWith("data:image/") || url.startsWith("blob:")) {
      try {
        const res = await fetch("/api/avatar", {
          method: "POST",
          body: JSON.stringify({ imageUrl: url }),
          headers: { "Content-Type": "application/json" }
        })
        const data = await res.json()
        if (data.morphs) {
          setMorphs(prev => ({ ...prev, ...data.morphs }))
        }
      } catch (err) {
        console.error("Failed to map face", err)
      }
    }
  }

  const handleExport = () => {
    setIsExporting(true)
    // We will trigger a global event or pass a ref to AvatarCanvas to handle export
    const event = new CustomEvent("export-avatar")
    window.dispatchEvent(event)
    setTimeout(() => setIsExporting(false), 1000)
  }

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
        <Button onClick={handleExport} disabled={!headUrl || isExporting}>
          <Download className="mr-2 h-4 w-4" />
          Export GLB
        </Button>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid md:grid-cols-[300px_1fr] gap-8 h-[calc(100vh-80px)]">
        <aside className="flex flex-col gap-8 bg-card p-6 rounded-2xl border border-border shadow-sm overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">1. Select Face</h2>
            </div>

            <div className="flex bg-secondary p-1 rounded-lg mb-4">
              <button
                onClick={() => setMode("upload")}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${mode === "upload" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <UploadCloud className="h-4 w-4" /> Upload
              </button>
              <button
                onClick={() => setMode("camera")}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${mode === "camera" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Camera className="h-4 w-4" /> Camera
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              {mode === "upload"
                ? "Upload a .glb file or image to map onto the base avatar head."
                : "Take a selfie to automatically map your face onto the 3D model."}
            </p>

            {mode === "upload" ? (
              <Upload onUpload={handleInput} />
            ) : (
              <CameraCapture onCapture={handleInput} />
            )}
          </div>

          {headUrl && (
            <div>
              <h2 className="text-lg font-semibold mb-4">2. Adjust Morphs</h2>
              <Sliders morphs={morphs} setMorphs={setMorphs} />
            </div>
          )}
        </aside>

        <section className="bg-secondary/30 rounded-2xl border border-border shadow-inner relative overflow-hidden">
          {headUrl ? (
            <AvatarCanvas headUrl={headUrl} morphs={morphs} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground flex-col gap-4">
              <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center">
                <svg className="h-10 w-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p>Upload a head model to start building your avatar</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
