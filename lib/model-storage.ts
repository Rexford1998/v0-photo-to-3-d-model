"use client"

const STORAGE_BUCKET_CANDIDATES = ["models", "model_uploads", "uploads"] as const

function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_")
}

function inferFileExtension(sourceUrl: string, contentType: string) {
  const lowerUrl = sourceUrl.toLowerCase()
  if (lowerUrl.endsWith(".glb") || contentType.includes("gltf-binary")) return ".glb"
  if (lowerUrl.endsWith(".gltf") || contentType.includes("model/gltf+json")) return ".gltf"
  if (lowerUrl.endsWith(".fbx")) return ".fbx"
  if (lowerUrl.endsWith(".obj")) return ".obj"
  return ".glb"
}

export function getSavableModelUrl(url: string): string | null {
  if (!url || url.startsWith("blob:")) return null
  if (url.startsWith("/api/proxy-model?url=")) return url
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `/api/proxy-model?url=${encodeURIComponent(url)}`
  }
  return url
}

export async function uploadModelUrlToStorage({
  sourceUrl,
  supabase,
  userId,
  fileNameBase,
}: {
  sourceUrl: string
  supabase: any
  userId: string
  fileNameBase: string
}) {
  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch model for storage upload (${response.status})`)
  }

  const blob = await response.blob()
  const extension = inferFileExtension(sourceUrl, blob.type || "")
  const safeBase = sanitizeFileSegment(fileNameBase)
  const fileName = `${safeBase}${extension}`
  const filePath = `${userId}/${Date.now()}-${fileName}`
  const file = new File([blob], fileName, {
    type: blob.type || "model/gltf-binary",
  })

  let uploadedBucket: string | null = null
  let lastUploadError: string | null = null

  for (const bucket of STORAGE_BUCKET_CANDIDATES) {
    const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
      upsert: false,
      contentType: file.type,
    })

    if (!error) {
      uploadedBucket = bucket
      break
    }

    lastUploadError = error.message
    const bucketMissing = error.message.toLowerCase().includes("bucket not found")
    if (!bucketMissing) {
      throw new Error(`Failed to upload model: ${error.message}`)
    }
  }

  if (!uploadedBucket) {
    throw new Error(
      `Failed to upload model: ${lastUploadError || "No compatible storage bucket found"}. Create a public bucket named "models" (or "model_uploads").`
    )
  }

  const { data } = supabase.storage.from(uploadedBucket).getPublicUrl(filePath)
  const publicUrl = data.publicUrl
  const savableUrl = getSavableModelUrl(publicUrl)

  if (!savableUrl) {
    throw new Error("Failed to prepare uploaded model URL for saving.")
  }

  return { bucket: uploadedBucket, filePath, publicUrl, savableUrl }
}
