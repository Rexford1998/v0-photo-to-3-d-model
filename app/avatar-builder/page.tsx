"use client"

import { useState } from "react"
import AvatarCanvas from "@/components/avatar/AvatarCanvas"
import { Upload } from "@/components/avatar/Upload"
import { CameraCapture } from "@/components/avatar/CameraCapture"
import Sliders from "@/components/avatar/Sliders"
import BodyCustomizer from "@/components/avatar/BodyCustomizer"
import { useAvatar } from "@/hooks/useAvatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Download, Camera, UploadCloud, User, SlidersHorizontal } from "lucide-react"

export default function AvatarBuilderPage() {
  const { headUrl, setHeadUrl, morphs, setMorphs, bodySettings, setBodySettings } = useAvatar()
  const [isExporting, setIsExporting] = useState(false)
  const [mode, setMode] = useState<"upload" | "camera">("upload")
  const [tab, setTab] = useState<"face" | "body" | "morphs">("face")

  const handleInput = (url: string) => {
    setHeadUrl(url)
    // Switch to body tab after face upload to guide user
    setTab("body")
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

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid md:grid-cols-[320px_1fr] gap-8 h-[calc(100vh-80px)]">
        <aside className="flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("face")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                tab === "face" 
                  ? "bg-background border-b-2 border-primary text-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Camera className="h-4 w-4" />
              Face
            </button>
            <button
              onClick={() => setTab("body")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                tab === "body" 
                  ? "bg-background border-b-2 border-primary text-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <User className="h-4 w-4" />
              Body
            </button>
            <button
              onClick={() => setTab("morphs")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                tab === "morphs" 
                  ? "bg-background border-b-2 border-primary text-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Fine Tune
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {tab === "face" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Upload Your Face</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a photo or take a selfie to create your avatar head.
                  </p>
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

                {mode === "upload" ? (
                  <Upload onUpload={handleInput} />
                ) : (
                  <CameraCapture onCapture={handleInput} />
                )}

                {headUrl && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      Face uploaded successfully! You can now customize your body.
                    </p>
                  </div>
                )}
              </div>
            )}

            {tab === "body" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Customize Body</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose body type, adjust proportions, and select clothing.
                  </p>
                </div>
                <BodyCustomizer bodySettings={bodySettings} setBodySettings={setBodySettings} />
              </div>
            )}

            {tab === "morphs" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Fine Tune Face</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Adjust facial features to perfect your avatar.
                  </p>
                </div>
                {headUrl ? (
                  <Sliders morphs={morphs} setMorphs={setMorphs} />
                ) : (
                  <div className="p-4 bg-secondary rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">
                      Upload a face first to enable morph adjustments.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        <section className="bg-secondary/30 rounded-2xl border border-border shadow-inner relative overflow-hidden">
          <AvatarCanvas headUrl={headUrl} morphs={morphs} bodySettings={bodySettings} />
          {!headUrl && (
            <div className="absolute bottom-4 left-4 right-4 flex justify-center pointer-events-none">
              <div className="bg-background/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border border-border">
                <p className="text-sm text-muted-foreground">
                  Upload a photo to replace the placeholder head
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
