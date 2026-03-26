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

  // Create an anchor point if it doesn't exist
  let anchor = base.getObjectByName("HeadAnchor")
  if (!anchor) {
    anchor = new THREE.Group()
    anchor.name = "HeadAnchor"
    // position the anchor approximately where the head is on a typical base body
    anchor.position.set(0, 1.5, 0)
    base.add(anchor)
  }

  // If the user uploaded an image or used the camera (blob/data URL), we map it as a texture
  // to the base head. If they uploaded a GLB, we load it.
  const isImage = userHeadUrl.startsWith("data:image/") ||
                 (userHeadUrl.startsWith("blob:") && !userHeadUrl.includes(".glb"))

  if (isImage) {
    // Apply image as a texture to the base head
    const textureLoader = new THREE.TextureLoader()
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      textureLoader.load(userHeadUrl, resolve, undefined, reject)
    })

    texture.colorSpace = THREE.SRGBColorSpace
    texture.flipY = false

    base.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        // Clone material so we don't affect other instances if there were any
        child.material = child.material.clone()
        child.material.map = texture
        child.material.needsUpdate = true
      }
    })
  } else {
    // Attempt to load as GLB
    try {
      const userHead = await load(userHeadUrl)
      normalizeHead(userHead)

      anchor.clear()
      anchor.add(userHead)
    } catch (e) {
      console.warn("Failed to load as GLB, might be an unsupported format.", e)
    }
  }

  // apply morphs
  base.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.morphTargetInfluences) {
      applyMorphs(obj, morphs)
    }
  })

  return base
}
