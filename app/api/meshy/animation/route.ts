import { NextRequest, NextResponse } from "next/server"

const MESHY_API_KEY = process.env.MESHY_API_KEY

function getMeshyErrorMessage(status: number, errorText: string) {
  let providerMessage = ""

  try {
    const parsed = JSON.parse(errorText)
    providerMessage = parsed?.message || parsed?.error || parsed?.detail || ""
  } catch {
    providerMessage = errorText
  }

  if (status === 402) {
    return "Meshy Animation API returned 402 (Payment Required). Animation generation needs Meshy credits. Add credits at meshy.ai and retry."
  }

  if (providerMessage) {
    return `Meshy Animation API error (${status}): ${providerMessage}`
  }

  return `Meshy Animation API error: ${status}`
}

// Popular animations from Meshy's library
export const ANIMATION_LIBRARY = [
  { id: 0, name: "Idle", category: "DailyActions" },
  { id: 1, name: "Walking", category: "WalkAndRun" },
  { id: 14, name: "Running", category: "WalkAndRun" },
  { id: 22, name: "Funny Dancing 1", category: "Dancing" },
  { id: 23, name: "Funny Dancing 2", category: "Dancing" },
  { id: 24, name: "Funny Dancing 3", category: "Dancing" },
  { id: 28, name: "Wave Hello", category: "DailyActions" },
  { id: 44, name: "Happy Jump", category: "BodyMovements" },
  { id: 59, name: "Victory Cheer", category: "BodyMovements" },
  { id: 64, name: "All Night Dance", category: "Dancing" },
  { id: 66, name: "Boom Dance", category: "Dancing" },
  { id: 74, name: "Gangnam Groove", category: "Dancing" },
  { id: 82, name: "Shake It Off", category: "Dancing" },
  { id: 87, name: "Boxing Practice", category: "Fighting" },
  { id: 96, name: "Kung Fu Punch", category: "Fighting" },
  { id: 207, name: "Roundhouse Kick", category: "Fighting" },
  { id: 325, name: "Jump Push Up", category: "WorkingOut" },
  { id: 326, name: "Jumping Jacks", category: "WorkingOut" },
  { id: 375, name: "Handstand Flip", category: "BodyMovements" },
  { id: 386, name: "Zombie Scream", category: "BodyMovements" },
  { id: 395, name: "Breakdance", category: "BodyMovements" },
  { id: 412, name: "Victory", category: "BodyMovements" },
  { id: 452, name: "Backflip", category: "BodyMovements" },
]

export async function GET() {
  return NextResponse.json({ animations: ANIMATION_LIBRARY })
}

export async function POST(request: NextRequest) {
  if (!MESHY_API_KEY) {
    return NextResponse.json(
      { error: "MESHY_API_KEY is not configured" },
      { status: 500 }
    )
  }

  try {
    const { rigTaskId, actionId } = await request.json()

    if (!rigTaskId) {
      return NextResponse.json(
        { error: "Rig task ID is required" },
        { status: 400 }
      )
    }

    if (actionId === undefined || actionId === null) {
      return NextResponse.json(
        { error: "Action ID is required" },
        { status: 400 }
      )
    }

    console.log("Creating animation task:", { rigTaskId, actionId })

    // Create animation task using Meshy API
    const response = await fetch("https://api.meshy.ai/openapi/v1/animations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MESHY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rig_task_id: rigTaskId,
        action_id: actionId,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Meshy Animation API error:", errorText)
      return NextResponse.json(
        { error: getMeshyErrorMessage(response.status, errorText) },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ taskId: data.result })
  } catch (error) {
    console.error("Error creating animation task:", error)
    return NextResponse.json(
      { error: "Failed to create animation task" },
      { status: 500 }
    )
  }
}
