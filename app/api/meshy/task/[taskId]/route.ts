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
      `https://api.meshy.ai/openapi/v1/image-to-3d/${taskId}`,
      {
        headers: {
          "Authorization": `Bearer ${MESHY_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch task: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching task:", error)
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    )
  }
}
