import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL parameter required" }, { status: 400 })
  }

  try {
    console.log("[proxy-model] Fetching URL:", url.substring(0, 100) + "...")
    
    const response = await fetch(url, {
      headers: {
        "Accept": "*/*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Encoding": "gzip, deflate",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      redirect: "follow",
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      console.error(`[proxy-model] Fetch failed: ${response.status} ${response.statusText}`, errorText.substring(0, 200))
      return NextResponse.json(
        { error: `Failed to fetch model: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const buffer = await response.arrayBuffer()
    console.log(`[proxy-model] Successfully fetched ${buffer.byteLength} bytes`)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": buffer.byteLength.toString(),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("[proxy-model] Error:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: "Failed to proxy model: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 }
    )
  }
}


