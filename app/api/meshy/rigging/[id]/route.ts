import { NextRequest, NextResponse } from "next/server"

const MESHY_API_KEY = process.env.MESHY_API_KEY

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!MESHY_API_KEY) {
    return NextResponse.json(
      { error: "MESHY_API_KEY is not configured" },
      { status: 500 }
    )
  }

  const { id } = await params

  try {
    const response = await fetch(
      `https://api.meshy.ai/openapi/v1/rigging/${id}`,
      {
        headers: {
          "Authorization": `Bearer ${MESHY_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch rigging task: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching rigging task:", error)
    return NextResponse.json(
      { error: "Failed to fetch rigging task" },
      { status: 500 }
    )
  }
}
