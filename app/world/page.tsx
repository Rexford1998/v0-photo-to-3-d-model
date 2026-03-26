"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function WorldPage() {
  const searchParams = useSearchParams()
  const modelUrl = searchParams.get("modelUrl")

  if (!modelUrl) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            Please generate a 3D avatar first to access the multiplayer world.
          </p>
          <Link href="/">
            <Button className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Generator
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="mb-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin text-2xl">🌐</div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Multiplayer World</h1>
          <p className="text-muted-foreground mb-4">
            Your 3D avatar is ready! The multiplayer world is currently being set up.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Model loaded successfully
          </p>
        </div>
        <div className="space-y-2 mb-6">
          <p className="text-sm font-medium">Coming Soon:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ Walk around in 3D space</li>
            <li>✓ See other players&apos; avatars</li>
            <li>✓ Real-time chat</li>
            <li>✓ Custom movements</li>
          </ul>
        </div>
        <Link href="/">
          <Button className="gap-2 w-full">
            <ArrowLeft className="h-4 w-4" />
            Back to Generator
          </Button>
        </Link>
      </div>
    </main>
  )
}
