import { createReadStream } from "node:fs"
import { access, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const BEACH_ASSET_FILES: Record<string, string> = {
  "palm-tree": "Meshy_AI_Palm_Tree_0401211341_texture.glb",
  "rock": "Meshy_AI_rock_0401211453_texture.glb",
  "rocky-pond-oasis": "Meshy_AI_Rocky_Pond_Oasis_0401211602_texture.glb",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> }
) {
  const { asset } = await params
  const fileName = BEACH_ASSET_FILES[asset]

  if (!fileName) {
    return NextResponse.json(
      { error: "Unknown beach asset" },
      { status: 404 }
    )
  }

  const filePath = path.join(os.homedir(), "Downloads", fileName)

  try {
    await access(filePath)
    const fileInfo = await stat(filePath)
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": fileInfo.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("Error serving beach asset:", error)

    return NextResponse.json(
      { error: `Beach asset not found at ~/Downloads/${fileName}` },
      { status: 404 }
    )
  }
}
