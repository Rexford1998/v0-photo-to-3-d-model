"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import { useEffect, useState, useRef } from "react"
import { createAvatar, type BodySettings } from "@/lib/avatarBuilder"
import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"

interface AvatarCanvasProps {
  headUrl: string | null
  morphs: Record<string, number>
  bodySettings: BodySettings
}

export default function AvatarCanvas({ headUrl, morphs, bodySettings }: AvatarCanvasProps) {
  const [avatar, setAvatar] = useState<THREE.Group | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sceneRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!headUrl) return

    setIsLoading(true)
    setError(null)

    createAvatar({ userHeadUrl: headUrl, morphs, body: bodySettings })
      .then((result) => {
        setAvatar(result)
        setIsLoading(false)
      })
      .catch(() => {
        setError("Failed to build avatar. Please try again.")
        setIsLoading(false)
      })
  }, [headUrl, morphs, bodySettings])

  useEffect(() => {
    const handleExport = () => {
      if (!sceneRef.current) return

      const exporter = new GLTFExporter()
      exporter.parse(
        sceneRef.current,
        (result) => {
          const blob = new Blob([result as BlobPart], { type: "model/gltf-binary" })
          const url = URL.createObjectURL(blob)

          const a = document.createElement("a")
          a.href = url
          a.download = "custom-avatar.glb"
          a.click()
        },
        (error) => {
          console.error("An error happened during export:", error)
        },
        { binary: true }
      )
    }

    window.addEventListener("export-avatar", handleExport)
    return () => window.removeEventListener("export-avatar", handleExport)
  }, [])

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
      <Canvas camera={{ position: [0, 1.2, 3], fov: 50 }} shadows gl={{ antialias: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />

        {avatar && (
          <group ref={sceneRef}>
            <primitive object={avatar} />
          </group>
        )}

        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={10} blur={2} far={4} />
        <Environment preset="city" />
        <OrbitControls target={[0, 1, 0]} minDistance={1.5} maxDistance={6} />
      </Canvas>
    </div>
  )
}
