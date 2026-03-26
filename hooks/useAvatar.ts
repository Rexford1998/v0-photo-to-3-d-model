import { useState } from "react"
import type { BodySettings } from "@/lib/avatarBuilder"

export function useAvatar() {
  const [headUrl, setHeadUrl] = useState<string | null>(null)
  const [bodySettings, setBodySettings] = useState<BodySettings>({
    gender: "male",
    height: 0.5,
    weight: 0.5,
    clothing: "casual",
  })

  return {
    headUrl,
    setHeadUrl,
    bodySettings,
    setBodySettings,
  }
}
