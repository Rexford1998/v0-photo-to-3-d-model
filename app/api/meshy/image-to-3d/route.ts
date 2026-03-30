import { NextRequest, NextResponse } from "next/server"

const MESHY_API_KEY = process.env.MESHY_API_KEY

function getMeshyErrorMessage(status: number, errorText: string) {
  let providerMessage = ""

  try {
    const parsed = JSON.parse(errorText)
    providerMessage = parsed?.message || parsed?.error || parsed?.detail || ""
  } catch {
    providerMessage = errorText
  }

  if (status === 402) {
    return "Meshy API returned 402 (Payment Required). Your account may be out of credits. Add funds or upgrade your plan at meshy.ai, then retry."
  }

  if (providerMessage) {
    return `Meshy API error (${status}): ${providerMessage}`
  }

  return `Meshy API error: ${status}`
}

export async function POST(request: NextRequest) {
  if (!MESHY_API_KEY) {
    return NextResponse.json(
      { error: "MESHY_API_KEY is not configured" },
      { status: 500 }
    )
  }

  try {
    const { imageUrl } = await request.json()

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "Image URL must be a valid string" },
        { status: 400 }
      )
    }

    if (!imageUrl.startsWith("data:image/") && !imageUrl.startsWith("http")) {
      return NextResponse.json(
        { error: "Image URL must be a data URL or HTTP URL" },
        { status: 400 }
      )
    }

    const response = await fetch("https://api.meshy.ai/openapi/v1/image-to-3d", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
        enable_pbr: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Meshy image-to-3d API error:", errorText)
      return NextResponse.json(
        { error: getMeshyErrorMessage(response.status, errorText) },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ taskId: data.result })
  } catch (error) {
    console.error("Error creating image-to-3d task:", error)
    return NextResponse.json(
      { error: "Failed to create image-to-3d task" },
      { status: 500 }
    )
  }
}
