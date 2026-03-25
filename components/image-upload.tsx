"use client"

// Image upload component with drag and drop - Force rebuild v3
import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, Image as ImageIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface ImageUploadProps {
  onImageSelect: (dataUrl: string) => void
  disabled?: boolean
}

export function ImageUpload({ onImageSelect, disabled }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          setPreview(result)
          onImageSelect(result)
        }
        reader.readAsDataURL(file)
      }
    },
    [onImageSelect]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxFiles: 1,
    disabled,
  })

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreview(null)
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300",
        isDragActive
          ? "border-accent bg-accent/10 scale-[1.02]"
          : "border-border bg-card hover:border-accent/50 hover:bg-secondary/50",
        disabled && "cursor-not-allowed opacity-50",
        preview && "border-solid border-accent/30"
      )}
    >
      <input {...getInputProps()} />

      {preview ? (
        <div className="relative h-full w-full p-4">
          <div className="relative h-64 w-full overflow-hidden rounded-xl">
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-contain"
            />
          </div>
          {!disabled && (
            <button
              onClick={clearImage}
              className="absolute right-6 top-6 rounded-full bg-background/90 p-2 text-muted-foreground shadow-lg transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Click or drop to replace
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <div className={cn(
            "rounded-2xl p-4 transition-all duration-300",
            isDragActive ? "bg-accent/20" : "bg-secondary"
          )}>
            {isDragActive ? (
              <ImageIcon className="h-10 w-10 text-accent" />
            ) : (
              <Upload className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {isDragActive ? "Drop your image here" : "Upload a character image"}
            </p>
            <p className="text-sm text-muted-foreground">
              JPG or PNG, humanoid characters work best
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
