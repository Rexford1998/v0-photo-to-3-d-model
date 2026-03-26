"use client"

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import type { BodySettings } from "@/lib/avatarBuilder"
import { User, Shirt } from "lucide-react"

interface BodyCustomizerProps {
  bodySettings: BodySettings
  setBodySettings: React.Dispatch<React.SetStateAction<BodySettings>>
}

const clothingOptions = [
  { value: "casual", label: "Casual", color: "bg-blue-500" },
  { value: "formal", label: "Formal", color: "bg-slate-700" },
  { value: "sporty", label: "Sporty", color: "bg-red-500" },
  { value: "none", label: "None", color: "bg-amber-200" },
] as const

export default function BodyCustomizer({ bodySettings, setBodySettings }: BodyCustomizerProps) {
  return (
    <div className="space-y-6">
      {/* Gender Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Body Type</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setBodySettings(prev => ({ ...prev, gender: "male" }))}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              bodySettings.gender === "male"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/50 hover:bg-accent/50"
            }`}
          >
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium">Male</span>
          </button>
          <button
            onClick={() => setBodySettings(prev => ({ ...prev, gender: "female" }))}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              bodySettings.gender === "female"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/50 hover:bg-accent/50"
            }`}
          >
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium">Female</span>
          </button>
        </div>
      </div>

      {/* Height Slider */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">Height</Label>
          <span className="text-xs text-muted-foreground font-mono">
            {(1.5 + bodySettings.height * 0.5).toFixed(2)}m
          </span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[bodySettings.height]}
          onValueChange={(val) =>
            setBodySettings(prev => ({ ...prev, height: val[0] }))
          }
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Short</span>
          <span>Tall</span>
        </div>
      </div>

      {/* Weight Slider */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">Build</Label>
          <span className="text-xs text-muted-foreground font-mono">
            {bodySettings.weight < 0.33 ? "Slim" : bodySettings.weight < 0.66 ? "Average" : "Athletic"}
          </span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[bodySettings.weight]}
          onValueChange={(val) =>
            setBodySettings(prev => ({ ...prev, weight: val[0] }))
          }
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Slim</span>
          <span>Athletic</span>
        </div>
      </div>

      {/* Clothing Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Shirt className="h-4 w-4" />
          Clothing Style
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {clothingOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setBodySettings(prev => ({ ...prev, clothing: option.value }))}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                bodySettings.clothing === option.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
            >
              <div className={`h-4 w-4 rounded-full ${option.color}`} />
              <span className="text-sm">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
