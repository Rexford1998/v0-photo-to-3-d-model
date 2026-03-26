"use server"

const MESHY_API_KEY = process.env.MESHY_API_KEY

export async function createImageTo3DTask(imageUrl: string) {
  if (!MESHY_API_KEY) {
    throw new Error("MESHY_API_KEY is not configured")
  }

  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("Image URL must be a valid string")
  }

  if (!imageUrl.startsWith("data:image/") && !imageUrl.startsWith("http")) {
    throw new Error("Image URL must be a data URL or HTTP URL")
  }

  const response = await fetch("https://api.meshy.ai/openapi/v1/image-to-3d", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MESHY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      enable_pbr: true,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("Meshy API error:", error)
    throw new Error(`Meshy API error: ${response.status}`)
  }

  const data = await response.json()
  return data.result
}
