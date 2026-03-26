import { NextRequest, NextResponse } from "next/server"

// Proxy endpoint to fetch GLB models from Meshy CDN
// This avoids CORS issues when loading external GLB files in Three.js
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    )
  }

  // Validate that the URL is from Meshy's CDN
  if (!url.startsWith("https://assets.meshy.ai/")) {
    return NextResponse.json(
      { error: "Invalid URL - only Meshy assets are allowed" },
      { status: 403 }
    )
  }

  try {
    const response = await fetch(url)

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch model: ${response.status}` },
        { status: response.status }
      )
    }

    const arrayBuffer = await response.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    })
  } catch (error) {
    console.error("Error proxying model:", error)
    return NextResponse.json(
      { error: "Failed to proxy model" },
      { status: 500 }
    )
  }
}
