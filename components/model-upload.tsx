"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, Package, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModelUploadProps {
  onModelSelect: (file: File, url: string) => void
  disabled?: boolean
}

export function ModelUpload({ onModelSelect, disabled }: ModelUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        // Create a local URL for the model file
        const url = URL.createObjectURL(file)
        setFileName(file.name)
        onModelSelect(file, url)
      }
    },
    [onModelSelect]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "model/gltf-binary": [".glb"],
      "model/gltf+json": [".gltf"],
    },
    maxFiles: 1,
    disabled,
  })

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFileName(null)
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300",
        isDragActive
          ? "border-accent bg-accent/10 scale-[1.02]"
          : "border-border bg-card hover:border-accent/50 hover:bg-secondary/50",
        disabled && "cursor-not-allowed opacity-50",
        fileName && "border-solid border-green-500/30 bg-green-500/5"
      )}
    >
      <input {...getInputProps()} />

      {fileName ? (
        <div className="flex items-center gap-3 p-4">
          <Package className="h-8 w-8 text-green-500" />
          <div>
            <p className="font-medium text-foreground">{fileName}</p>
            <p className="text-sm text-muted-foreground">Model uploaded</p>
          </div>
          {!disabled && (
            <button
              onClick={clearFile}
              className="ml-2 rounded-full bg-background/90 p-2 text-muted-foreground shadow-lg transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <div className={cn(
            "rounded-xl p-3 transition-all duration-300",
            isDragActive ? "bg-accent/20" : "bg-secondary"
          )}>
            {isDragActive ? (
              <Package className="h-6 w-6 text-accent" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              {isDragActive ? "Drop your model here" : "Or upload a GLB/GLTF model"}
            </p>
            <p className="text-xs text-muted-foreground">
              Preview, rig for animation, and save to your account
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
