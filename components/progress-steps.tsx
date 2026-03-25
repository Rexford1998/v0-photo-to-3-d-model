"use client"

import { cn } from "@/lib/utils"
import { Check, Loader2, Circle } from "lucide-react"

export type StepStatus = "pending" | "active" | "completed" | "error"

interface Step {
  id: string
  label: string
  description?: string
}

interface ProgressStepsProps {
  steps: Step[]
  currentStep: number
  progress?: number
  error?: string
}

export function ProgressSteps({
  steps,
  currentStep,
  progress,
  error,
}: ProgressStepsProps) {
  const getStepStatus = (index: number): StepStatus => {
    if (error && index === currentStep) return "error"
    if (index < currentStep) return "completed"
    if (index === currentStep) return "active"
    return "pending"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(index)
          const isLast = index === steps.length - 1

          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                    status === "completed" && "border-accent bg-accent text-accent-foreground",
                    status === "active" && "border-primary bg-primary text-primary-foreground",
                    status === "pending" && "border-border bg-card text-muted-foreground",
                    status === "error" && "border-destructive bg-destructive/10 text-destructive"
                  )}
                >
                  {status === "completed" && <Check className="h-5 w-5" />}
                  {status === "active" && <Loader2 className="h-5 w-5 animate-spin" />}
                  {status === "pending" && <Circle className="h-4 w-4" />}
                  {status === "error" && <span className="font-bold">!</span>}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      "text-xs font-medium",
                      status === "active" && "text-foreground",
                      status === "completed" && "text-accent",
                      status === "pending" && "text-muted-foreground",
                      status === "error" && "text-destructive"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 transition-all duration-500",
                    status === "completed" ? "bg-accent" : "bg-border"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Progress bar for current step */}
      {currentStep < steps.length && progress !== undefined && (
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {progress}% complete
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
