"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { UploadCloud, Check, AlertCircle } from "lucide-react"

export function Upload({ onUpload }: { onUpload: (url: string) => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [fileName, setFileName] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    setFileName(file.name)
    setStatus("loading")

    // For images, convert to data URL for better cross-origin handling
    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        onUpload(dataUrl)
        setStatus("success")
      }
      reader.onerror = () => {
        console.error("[v0] Failed to read image file")
        setStatus("error")
      }
      reader.readAsDataURL(file)
    } else {
      // For GLB files, use object URL
      const url = URL.createObjectURL(file)
      onUpload(url)
      setStatus("success")
    }
  }

  return (
    <div className={`relative border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer text-center group ${
      status === "success" ? "border-green-500 bg-green-500/5" : 
      status === "error" ? "border-destructive bg-destructive/5" : 
      "border-border hover:bg-accent/5"
    }`}>
      <Input
        type="file"
        accept=".glb,image/*"
        onChange={handleFile}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      {status === "success" ? (
        <>
          <Check className="mx-auto h-8 w-8 mb-2 text-green-500" />
          <span className="text-sm font-medium text-green-600 dark:text-green-400">Uploaded successfully!</span>
          {fileName && <p className="text-xs text-muted-foreground mt-1 truncate">{fileName}</p>}
        </>
      ) : status === "error" ? (
        <>
          <AlertCircle className="mx-auto h-8 w-8 mb-2 text-destructive" />
          <span className="text-sm font-medium text-destructive">Upload failed</span>
          <p className="text-xs text-muted-foreground mt-1">Please try again</p>
        </>
      ) : status === "loading" ? (
        <>
          <div className="mx-auto h-8 w-8 mb-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium">Processing...</span>
        </>
      ) : (
        <>
          <UploadCloud className="mx-auto h-8 w-8 mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-medium">Click or drag file to upload</span>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG or .glb files</p>
        </>
      )}
    </div>
  )
}
