"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import { useEffect, useState, useRef } from "react"
import { createAvatar } from "@/lib/avatarBuilder"
import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"

export default function AvatarCanvas({ headUrl, morphs }: { headUrl: string | null, morphs: Record<string, number> }) {
  const [avatar, setAvatar] = useState<THREE.Group | null>(null)
  const sceneRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!headUrl) return

    createAvatar({ userHeadUrl: headUrl, morphs }).then(setAvatar)
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
    <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }} shadows gl={{ antialias: true }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />

      {avatar && (
        <group ref={sceneRef}>
          <primitive object={avatar} />
        </group>
      )}

      <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={10} blur={2} far={4} />
      <Environment preset="city" />
      <OrbitControls target={[0, 1.5, 0]} minDistance={1} maxDistance={5} />
    </Canvas>
  )
}
