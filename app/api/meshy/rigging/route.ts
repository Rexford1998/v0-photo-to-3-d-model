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
    return "Meshy Rigging API returned 402 (Payment Required). Rigging requires available Meshy credits. Add credits at meshy.ai and retry."
  }

  if (providerMessage) {
    return `Meshy Rigging API error (${status}): ${providerMessage}`
  }

  return `Meshy Rigging API error: ${status}`
}

export async function POST(request: NextRequest) {
  if (!MESHY_API_KEY) {
    return NextResponse.json(
      { error: "MESHY_API_KEY is not configured" },
      { status: 500 }
    )
  }

  try {
    const { modelUrl } = await request.json()

    if (!modelUrl) {
      return NextResponse.json(
        { error: "Model URL is required" },
        { status: 400 }
      )
    }

    // Validate URL format
    if (!modelUrl.startsWith("http")) {
      console.error("Invalid model URL format:", modelUrl)
      return NextResponse.json(
        { error: "Invalid model URL format - must be a valid HTTP URL" },
        { status: 400 }
      )
    }

    console.log("Creating rigging task for model:", modelUrl)

    // Create rigging task - this will also generate walking animation
    const response = await fetch("https://api.meshy.ai/openapi/v1/rigging", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MESHY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_url: modelUrl,
        height_meters: 1.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Meshy Rigging API error:", errorText)
      return NextResponse.json(
        { error: getMeshyErrorMessage(response.status, errorText) },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ taskId: data.result })
  } catch (error) {
    console.error("Error creating rigging task:", error)
    return NextResponse.json(
      { error: "Failed to create rigging task" },
      { status: 500 }
    )
  }
}
