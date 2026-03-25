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
    const { modelUrl } = await request.json()

    if (!modelUrl) {
      return NextResponse.json(
        { error: "Model URL is required" },
        { status: 400 }
      )
    }

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
      const error = await response.text()
      console.error("Meshy Rigging API error:", error)
      return NextResponse.json(
        { error: `Meshy Rigging API error: ${response.status}` },
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
