"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import { useEffect, useState, useRef } from "react"
import { createAvatar } from "@/lib/avatarBuilder"
import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"

export default function AvatarCanvas({ headUrl, morphs }: { headUrl: string | null, morphs: Record<string, number> }) {
  const [avatar, setAvatar] = useState<THREE.Group | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sceneRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!headUrl) {
      setAvatar(null)
      return
    }

    const loadAvatar = async () => {
      try {
        setLoading(true)
        setError(null)
        const newAvatar = await createAvatar({ userHeadUrl: headUrl, morphs })
        setAvatar(newAvatar)
      } catch (err) {
        console.error("Failed to load avatar:", err)
        setError(err instanceof Error ? err.message : "Failed to load avatar")
        setAvatar(null)
      } finally {
        setLoading(false)
      }
    }

    loadAvatar()
  }, [headUrl, morphs])

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
          URL.revokeObjectURL(url)
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

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-500/10 rounded-lg">
        <p className="text-red-600 text-center">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading avatar...</p>
        </div>
      </div>
    )
  }

  return (
    <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }} shadows gl={{ antialias: true }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <pointLight position={[-5, 5, 5]} intensity={0.6} />
      
      {avatar && (
        <group ref={sceneRef}>
          <primitive object={avatar} />
        </group>
      )}

      <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={10} blur={2} far={4} />
      <Environment preset="city" />
      <OrbitControls 
        target={[0, 1.5, 0]} 
        minDistance={1.5} 
        maxDistance={6}
        autoRotate={false}
      />
    </Canvas>
  )
}
