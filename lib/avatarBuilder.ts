import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { normalizeHead } from "./normalize"
import { applyMorphs } from "./morphTargets"

const loader = new GLTFLoader()

function load(url: string): Promise<THREE.Group> {
  return new Promise((res, rej) => loader.load(url, (g) => res(g.scene), undefined, rej))
}

export async function createAvatar({ userHeadUrl, morphs }: { userHeadUrl: string, morphs: Record<string, number> }) {
  const base = await load("/models/base-head.glb")
  
  let anchor = base.getObjectByName("HeadAnchor")
  if (!anchor) {
    anchor = new THREE.Group()
    anchor.name = "HeadAnchor"
    anchor.position.set(0, 1.5, 0)
    base.add(anchor)
  }

  const isImage = userHeadUrl.startsWith("data:image/") || 
                 (userHeadUrl.startsWith("blob:") && !userHeadUrl.includes("glb")) ||
                 /\.(jpg|jpeg|png|webp)$/i.test(userHeadUrl)
                 
  if (isImage) {
    const textureLoader = new THREE.TextureLoader()
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      textureLoader.load(userHeadUrl, resolve, undefined, reject)
    })
    
    texture.colorSpace = THREE.SRGBColorSpace
    texture.flipY = false

    base.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => {
            const cloned = m.clone() as THREE.MeshStandardMaterial
            cloned.map = texture
            cloned.needsUpdate = true
            return cloned
          })
        } else {
          const cloned = (child.material as THREE.Material).clone() as THREE.MeshStandardMaterial
          cloned.map = texture
          cloned.needsUpdate = true
          child.material = cloned
        }
      }
    })
  } else {
    try {
      const userHead = await load(userHeadUrl)
      normalizeHead(userHead)
      
      anchor.clear()
      anchor.add(userHead)
    } catch (e) {
      console.warn("Failed to load as GLB, treating as image fallback", e)
    }
  }

  base.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.morphTargetInfluences) {
      applyMorphs(obj, morphs)
    }
  })

  return base
}
