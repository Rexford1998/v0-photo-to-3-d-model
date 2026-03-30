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

  try {
    const { taskId } = await params

    const response = await fetch(
      `https://api.meshy.ai/openapi/v1/rigging/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${MESHY_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error("Meshy Rigging status error:", error)
      return NextResponse.json(
        { error: `Failed to get rigging status: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      status: data.status,
      progress: data.progress || 0,
      result: data.status === "SUCCEEDED" ? {
        rigged_character_glb_url: data.rigged_character_glb_url,
        basic_animations: data.basic_animations,
      } : null,
      error: data.status === "FAILED" ? data.task_error?.message : null,
    })
  } catch (error) {
    console.error("Error checking rigging status:", error)
    return NextResponse.json(
      { error: "Failed to check rigging status" },
      { status: 500 }
    )
  }
}
