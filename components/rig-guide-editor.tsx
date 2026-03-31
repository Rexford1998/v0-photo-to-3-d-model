"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"

export type RigGuideKey = "head" | "leftHand" | "rightHand" | "leftFoot" | "rightFoot"

export type RigGuidePoints = Partial<Record<RigGuideKey, { x: number; y: number }>>

const GUIDE_LABELS: Record<RigGuideKey, string> = {
  head: "Head",
  leftHand: "Left Hand",
  rightHand: "Right Hand",
  leftFoot: "Left Foot",
  rightFoot: "Right Foot",
}

interface RigGuideEditorProps {
  imageUrl: string
  points: RigGuidePoints
  onChange: (points: RigGuidePoints) => void
}

export function RigGuideEditor({ imageUrl, points, onChange }: RigGuideEditorProps) {
  const [activeKey, setActiveKey] = useState<RigGuideKey>("head")

  const orderedKeys = useMemo(() => Object.keys(GUIDE_LABELS) as RigGuideKey[], [])

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))

    onChange({
      ...points,
      [activeKey]: { x, y },
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div>
        <h3 className="font-medium text-foreground">Rigging Guide (Optional)</h3>
        <p className="text-sm text-muted-foreground">
          Click the image to place key arm/leg points before generation.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {orderedKeys.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={activeKey === key ? "default" : "outline"}
            onClick={() => setActiveKey(key)}
          >
            {GUIDE_LABELS[key]}
          </Button>
        ))}
      </div>

      <div
        className="relative mx-auto max-w-md cursor-crosshair overflow-hidden rounded-lg border border-border"
        onClick={handleImageClick}
      >
        <img src={imageUrl} alt="Rigging guide preview" className="w-full h-auto block" />

        {orderedKeys.map((key) => {
          const point = points[key]
          if (!point) return null

          return (
            <div
              key={key}
              className="absolute"
              style={{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="h-3 w-3 rounded-full bg-primary border-2 border-background" />
              <span className="mt-1 block rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-foreground border border-border whitespace-nowrap">
                {GUIDE_LABELS[key]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
