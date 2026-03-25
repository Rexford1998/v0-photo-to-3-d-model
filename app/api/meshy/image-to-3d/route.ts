import { NextRequest, NextResponse } from "next/server"

const MESHY_API_KEY = process.env.MESHY_API_KEY

export async function POST(request: NextRequest) {
  if (!MESHY_API_KEY) {
    return NextResponse.json(
      { error: "MESHY_API_KEY is not configured" },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const imageUrl = body.imageUrl

    if (!imageUrl || typeof imageUrl !== "string") {
      console.log("[v0] Invalid imageUrl - type:", typeof imageUrl)
      return NextResponse.json(
        { error: "Image URL must be a valid string" },
        { status: 400 }
      )
    }

    // Ensure the image URL is a valid data URL or http URL
    if (!imageUrl.startsWith("data:image/") && !imageUrl.startsWith("http")) {
      console.log("[v0] Invalid imageUrl format:", imageUrl.substring(0, 50))
      return NextResponse.json(
        { error: "Image URL must be a data URL or HTTP URL" },
        { status: 400 }
      )
    }

    console.log("[v0] Sending to Meshy - imageUrl type:", typeof imageUrl, "starts with:", imageUrl.substring(0, 30))

    // Create Image to 3D task
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
      return NextResponse.json(
        { error: `Meshy API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ taskId: data.result })
  } catch (error) {
    console.error("Error creating Image to 3D task:", error)
    return NextResponse.json(
      { error: "Failed to create Image to 3D task" },
      { status: 500 }
    )
  }
}
