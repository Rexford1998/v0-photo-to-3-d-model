import { useState } from "react"

export function useAvatar() {
  const [headUrl, setHeadUrl] = useState<string | null>(null)
  const [morphs, setMorphs] = useState<Record<string, number>>({
    faceWidth: 0.5,
    jawSize: 0.5,
    noseSize: 0.5,
  })

  return {
    headUrl,
    setHeadUrl,
    morphs,
    setMorphs,
  }
}
