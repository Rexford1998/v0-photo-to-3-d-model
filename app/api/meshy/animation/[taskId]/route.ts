import { NextRequest, NextResponse } from "next/server"

const MESHY_API_KEY = process.env.MESHY_API_KEY

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  if (!MESHY_API_KEY) {
    return NextResponse.json(
      { error: "MESHY_API_KEY is not configured" },
      { status: 500 }
    )
  }

  const { taskId } = await params

  try {
    const response = await fetch(
      `https://api.meshy.ai/openapi/v1/animations/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${MESHY_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error("Meshy Animation status error:", error)
      return NextResponse.json(
        { error: `Failed to get animation status: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    console.log("[v0] Full Meshy animation response:", JSON.stringify(data, null, 2))
    
    // Meshy Animation API returns URL in result.animation_glb_url
    const modelUrl = 
      data.result?.animation_glb_url || 
      data.result?.animation_fbx_url ||
      null
    
    return NextResponse.json({
      status: data.status,
      progress: data.progress || 0,
      modelUrl: modelUrl,
      error: data.task_error?.message || null,
    })
  } catch (error) {
    console.error("Error checking animation status:", error)
    return NextResponse.json(
      { error: "Failed to check animation status" },
      { status: 500 }
    )
  }
}
