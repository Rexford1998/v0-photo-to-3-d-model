"use client"

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import React from "react"

interface SlidersProps {
  morphs: Record<string, number>
  setMorphs: React.Dispatch<React.SetStateAction<Record<string, number>>>
}

export default function Sliders({ morphs, setMorphs }: SlidersProps) {
  return (
    <div className="space-y-6">
      {Object.keys(morphs).map((key) => (
        <div key={key} className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="capitalize text-sm font-medium">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </Label>
            <span className="text-xs text-muted-foreground w-8 text-right font-mono">
              {morphs[key].toFixed(2)}
            </span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[morphs[key]]}
            onValueChange={(val) =>
              setMorphs((prev) => ({
                ...prev,
                [key]: val[0],
              }))
            }
          />
        </div>
      ))}
    </div>
  )
}
