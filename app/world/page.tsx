"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe, Users, MessageCircle, Footprints } from "lucide-react"
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
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <div className="max-w-lg text-center">
        <div className="mb-8">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Globe className="h-10 w-10 text-primary animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Multiplayer World</h1>
          <p className="text-muted-foreground text-lg mb-2">
            Your 3D avatar is ready!
          </p>
          <p className="text-sm text-muted-foreground">
            The multiplayer world is currently under development.
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 mb-8">
          <p className="text-sm font-semibold mb-4">Coming Soon</p>
          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Footprints className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Walk Around</p>
                <p className="text-xs text-muted-foreground">Explore 3D spaces</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Meet Others</p>
                <p className="text-xs text-muted-foreground">See other avatars</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Real-time Chat</p>
                <p className="text-xs text-muted-foreground">Talk with players</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Shared World</p>
                <p className="text-xs text-muted-foreground">Persistent spaces</p>
              </div>
            </div>
          </div>
        </div>

        <Link href="/">
          <Button variant="outline" className="gap-2 w-full">
            <ArrowLeft className="h-4 w-4" />
            Back to Generator
          </Button>
        </Link>
      </div>
    </main>
  )
}
