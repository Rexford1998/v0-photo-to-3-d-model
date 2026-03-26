"use client"

import { Input } from "@/components/ui/input"
import { UploadCloud } from "lucide-react"

export function Upload({ onUpload }: { onUpload: (url: string) => void }) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]

    // Instead of uploading to a backend that would fail on Vercel's read-only filesystem,
    // we can simply create a local object URL to view the file immediately in the canvas.
    // If the user later connects a database or Vercel Blob, they can upload the file then.
    const url = URL.createObjectURL(file)
    onUpload(url)
  }

  return (
    <div className="relative border-2 border-dashed border-border rounded-xl p-6 hover:bg-accent/5 transition-colors cursor-pointer text-center group">
      <Input
        type="file"
        accept=".glb,image/*"
        onChange={handleFile}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <UploadCloud className="mx-auto h-8 w-8 mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
      <span className="text-sm font-medium">Click or drag file to upload</span>
      <p className="text-xs text-muted-foreground mt-1">.glb or image files</p>
    </div>
  )
}
