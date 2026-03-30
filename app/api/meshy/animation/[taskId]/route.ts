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
    
    // Try all possible locations for the GLB URL in Meshy's response
    const modelUrl = 
      data.result?.glb_url || 
      data.result?.fbx_url ||
      data.glb_url ||
      data.output?.glb_url ||
      data.model_urls?.glb ||
      data.output ||
      null
    
    return NextResponse.json({
      status: data.status,
      progress: data.progress || 0,
      modelUrl: modelUrl,
      error: data.task_error?.message || null,
      // Include raw response for debugging
      _debug_raw: data,
    })
  } catch (error) {
    console.error("Error checking animation status:", error)
    return NextResponse.json(
      { error: "Failed to check animation status" },
      { status: 500 }
    )
  }
}
