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
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      )
    }

    // Create Image to 3D task with pose mode for better rigging
    const response = await fetch("https://api.meshy.ai/openapi/v1/image-to-3d", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MESHY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
        enable_pbr: true,
        should_remesh: true,
        should_texture: true,
        pose_mode: "t-pose", // T-pose is ideal for rigging
        target_polycount: 30000,
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
