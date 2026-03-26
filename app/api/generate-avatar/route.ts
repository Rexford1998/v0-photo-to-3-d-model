import { NextRequest, NextResponse } from "next/server"

const MESHY_API_KEY = process.env.MESHY_API_KEY

interface GenerateAvatarRequest {
  imageUrl: string
  gender: "male" | "female"
  height: number // 0-1 scale
  weight: number // 0-1 scale  
  clothing: "casual" | "formal" | "sporty" | "none"
}

interface MeshyTaskResponse {
  result: string // task ID
}

interface MeshyTaskStatus {
  id: string
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "EXPIRED"
  progress: number
  model_urls?: {
    glb?: string
    fbx?: string
    obj?: string
    usdz?: string
  }
  thumbnail_url?: string
  task_error?: {
    message: string
  }
}

// Build a texture prompt based on avatar settings
function buildTexturePrompt(settings: Omit<GenerateAvatarRequest, "imageUrl">): string {
  const { gender, height, weight, clothing } = settings
  
  // Convert height/weight to descriptive terms
  const heightDesc = height < 0.33 ? "short" : height < 0.66 ? "average height" : "tall"
  const buildDesc = weight < 0.33 ? "slim" : weight < 0.66 ? "average build" : "muscular"
  
  // Clothing descriptions
  const clothingDesc: Record<string, string> = {
    casual: "casual clothing, t-shirt and jeans",
    formal: "formal business attire, suit and dress shoes",
    sporty: "athletic sportswear, tracksuit and sneakers",
    none: "minimal clothing, neutral skin tone"
  }
  
  return `A ${heightDesc} ${buildDesc} ${gender} human avatar wearing ${clothingDesc[clothing]}. Full body, standing pose, clean simple style suitable for a game character or virtual avatar.`
}

export async function POST(request: NextRequest) {
  if (!MESHY_API_KEY) {
    return NextResponse.json(
      { error: "MESHY_API_KEY is not configured" },
      { status: 500 }
    )
  }

  try {
    const body: GenerateAvatarRequest = await request.json()
    const { imageUrl, gender, height, weight, clothing } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      )
    }

    // Build texture prompt from settings
    const texturePrompt = buildTexturePrompt({ gender, height, weight, clothing })

    // Create Meshy Image-to-3D task with all parameters
    const createResponse = await fetch("https://api.meshy.ai/openapi/v1/image-to-3d", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MESHY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_url: imageUrl,
        ai_model: "meshy-6",
        model_type: "standard",
        topology: "quad",
        target_polycount: 50000,
        symmetry_mode: "auto",
        should_remesh: true,
        should_texture: true,
        enable_pbr: true,
        pose_mode: "a-pose",
        texture_prompt: texturePrompt,
        image_enhancement: true,
        remove_lighting: true,
        target_formats: ["glb"],
        auto_size: true,
        origin_at: "bottom",
        moderation: true
      })
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error("Meshy API error:", errorText)
      return NextResponse.json(
        { error: `Meshy API error: ${createResponse.status}` },
        { status: createResponse.status }
      )
    }

    const createResult: MeshyTaskResponse = await createResponse.json()
    const taskId = createResult.result

    return NextResponse.json({
      taskId,
      status: "PENDING",
      message: "Avatar generation started"
    })

  } catch (error) {
    console.error("Error creating avatar:", error)
    return NextResponse.json(
      { error: "Failed to start avatar generation" },
      { status: 500 }
    )
  }
}

// GET endpoint to check task status
export async function GET(request: NextRequest) {
  if (!MESHY_API_KEY) {
    return NextResponse.json(
      { error: "MESHY_API_KEY is not configured" },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get("taskId")

  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required" },
      { status: 400 }
    )
  }

  try {
    const statusResponse = await fetch(`https://api.meshy.ai/openapi/v1/image-to-3d/${taskId}`, {
      headers: {
        "Authorization": `Bearer ${MESHY_API_KEY}`
      }
    })

    if (!statusResponse.ok) {
      return NextResponse.json(
        { error: `Failed to get task status: ${statusResponse.status}` },
        { status: statusResponse.status }
      )
    }

    const taskStatus: MeshyTaskStatus = await statusResponse.json()

    return NextResponse.json({
      taskId: taskStatus.id,
      status: taskStatus.status,
      progress: taskStatus.progress,
      modelUrl: taskStatus.model_urls?.glb || null,
      thumbnailUrl: taskStatus.thumbnail_url || null,
      error: taskStatus.task_error?.message || null
    })

  } catch (error) {
    console.error("Error checking task status:", error)
    return NextResponse.json(
      { error: "Failed to check task status" },
      { status: 500 }
    )
  }
}
