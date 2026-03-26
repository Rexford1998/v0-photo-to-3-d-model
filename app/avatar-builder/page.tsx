"use client"

import { useState } from "react"
import AvatarCanvas from "@/components/avatar/AvatarCanvas"
import { Upload } from "@/components/avatar/Upload"
import { CameraCapture } from "@/components/avatar/CameraCapture"
import BodyCustomizer from "@/components/avatar/BodyCustomizer"
import { useAvatar } from "@/hooks/useAvatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Download, Camera, UploadCloud, Wand2 } from "lucide-react"
import type { BodySettings } from "@/lib/avatarBuilder"

export default function AvatarBuilderPage() {
  const { headUrl, setHeadUrl, morphs, bodySettings, setBodySettings } = useAvatar()
  const [isExporting, setIsExporting] = useState(false)
  const [captureMode, setCaptureMode] = useState<"upload" | "camera">("upload")

  // Separate "committed" settings that are only applied when Generate is clicked
  const [committed, setCommitted] = useState<{
    headUrl: string | null
    bodySettings: BodySettings
  } | null>(null)

  const [generated, setGenerated] = useState(false)

  const handleInput = (url: string) => {
    setHeadUrl(url)
    setGenerated(false)
  }

  const handleGenerate = () => {
    if (!headUrl) return
    setCommitted({ headUrl, bodySettings })
    setGenerated(true)
  }

  const handleExport = () => {
    setIsExporting(true)
    window.dispatchEvent(new CustomEvent("export-avatar"))
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
        <Button onClick={handleExport} disabled={!generated || isExporting} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export GLB
        </Button>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid md:grid-cols-[360px_1fr] gap-8 h-[calc(100vh-73px)]">

        {/* ── Left panel: form ── */}
        <aside className="flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-8">

            {/* Step 1 – Photo */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <h2 className="text-base font-semibold">Upload Your Photo</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Your photo is used to trigger avatar generation. It is not mapped onto the model.
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

            {/* Step 2 – Body */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <h2 className="text-base font-semibold">Body &amp; Clothing</h2>
              </div>
              <BodyCustomizer bodySettings={bodySettings} setBodySettings={setBodySettings} />
            </section>
          </div>

          {/* Generate button pinned to bottom */}
          <div className="p-4 border-t border-border bg-card">
            <Button
              className="w-full h-11 text-base font-semibold"
              onClick={handleGenerate}
              disabled={!headUrl}
            >
              <Wand2 className="mr-2 h-5 w-5" />
              Generate 3D Avatar
            </Button>
            {!headUrl && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Upload a photo first to enable generation
              </p>
            )}
          </div>
        </aside>

        {/* ── Right panel: canvas ── */}
        <section className="bg-secondary/30 rounded-2xl border border-border shadow-inner relative overflow-hidden">
          {committed ? (
            <AvatarCanvas
              headUrl={committed.headUrl}
              morphs={morphs}
              bodySettings={committed.bodySettings}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
                <Wand2 className="h-9 w-9 opacity-40" />
              </div>
              <p className="text-sm text-center px-8">
                Fill in your details and click <span className="font-semibold text-foreground">Generate 3D Avatar</span> to see your avatar here
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
