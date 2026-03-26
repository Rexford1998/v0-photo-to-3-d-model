import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { normalizeHead } from "./normalize"
import { applyMorphs } from "./morphTargets"

const loader = new GLTFLoader()

function load(url: string): Promise<THREE.Group> {
  return new Promise((res, rej) => loader.load(url, (g) => res(g.scene), undefined, rej))
}

export interface BodySettings {
  gender: "male" | "female"
  height: number // 0-1 scale
  weight: number // 0-1 scale
  clothing: "casual" | "formal" | "sporty" | "none"
}

export interface AvatarSettings {
  userHeadUrl: string
  morphs: Record<string, number>
  body: BodySettings
}

// Create body mesh procedurally based on settings
function createBody(settings: BodySettings): THREE.Group {
  const body = new THREE.Group()
  body.name = "AvatarBody"
  
  // Calculate dimensions based on settings
  const baseHeight = settings.gender === "male" ? 1.7 : 1.6
  const heightScale = 0.85 + (settings.height * 0.3) // 0.85 to 1.15
  const weightScale = 0.8 + (settings.weight * 0.4) // 0.8 to 1.2
  
  // Body color based on gender (skin tone - can be customized later)
  const skinColor = new THREE.Color(0xd4a574)
  const skinMaterial = new THREE.MeshStandardMaterial({ 
    color: skinColor,
    roughness: 0.7,
    metalness: 0.0
  })
  
  // Clothing colors
  const clothingColors = {
    casual: { top: 0x4a90d9, bottom: 0x2c3e50 },
    formal: { top: 0x2c3e50, bottom: 0x1a252f },
    sporty: { top: 0xe74c3c, bottom: 0x2c3e50 },
    none: { top: 0xd4a574, bottom: 0xd4a574 }
  }
  
  const colors = clothingColors[settings.clothing]
  const topMaterial = new THREE.MeshStandardMaterial({ 
    color: colors.top,
    roughness: 0.8,
    metalness: 0.0
  })
  const bottomMaterial = new THREE.MeshStandardMaterial({ 
    color: colors.bottom,
    roughness: 0.8,
    metalness: 0.0
  })
  
  // Gender-specific proportions
  const shoulderWidth = settings.gender === "male" ? 0.45 * weightScale : 0.38 * weightScale
  const hipWidth = settings.gender === "male" ? 0.35 * weightScale : 0.4 * weightScale
  
  // Torso (upper body)
  const torsoHeight = 0.5 * heightScale
  const torsoGeometry = new THREE.CylinderGeometry(
    shoulderWidth * 0.5, // top radius
    hipWidth * 0.5 * 0.9, // bottom radius
    torsoHeight,
    16
  )
  const torso = new THREE.Mesh(torsoGeometry, topMaterial)
  torso.position.y = torsoHeight / 2 + 0.5 * heightScale
  torso.castShadow = true
  torso.receiveShadow = true
  body.add(torso)
  
  // Hips/Lower torso
  const hipsHeight = 0.2 * heightScale
  const hipsGeometry = new THREE.CylinderGeometry(
    hipWidth * 0.5 * 0.9,
    hipWidth * 0.5,
    hipsHeight,
    16
  )
  const hips = new THREE.Mesh(hipsGeometry, bottomMaterial)
  hips.position.y = hipsHeight / 2 + 0.3 * heightScale
  hips.castShadow = true
  hips.receiveShadow = true
  body.add(hips)
  
  // Legs
  const legLength = 0.8 * heightScale
  const legRadius = 0.08 * weightScale
  const legGeometry = new THREE.CylinderGeometry(legRadius * 0.8, legRadius, legLength, 12)
  
  // Left leg
  const leftLeg = new THREE.Mesh(legGeometry, bottomMaterial)
  leftLeg.position.set(-hipWidth * 0.25, legLength / 2 - 0.5 * heightScale, 0)
  leftLeg.castShadow = true
  leftLeg.receiveShadow = true
  body.add(leftLeg)
  
  // Right leg
  const rightLeg = new THREE.Mesh(legGeometry, bottomMaterial)
  rightLeg.position.set(hipWidth * 0.25, legLength / 2 - 0.5 * heightScale, 0)
  rightLeg.castShadow = true
  rightLeg.receiveShadow = true
  body.add(rightLeg)
  
  // Arms
  const armLength = 0.55 * heightScale
  const armRadius = 0.05 * weightScale
  const armGeometry = new THREE.CylinderGeometry(armRadius * 0.8, armRadius, armLength, 12)
  
  // Left arm
  const leftArm = new THREE.Mesh(armGeometry, settings.clothing === "none" ? skinMaterial : topMaterial)
  leftArm.position.set(-shoulderWidth * 0.5 - armRadius, torsoHeight / 2 + 0.4 * heightScale, 0)
  leftArm.rotation.z = 0.15
  leftArm.castShadow = true
  leftArm.receiveShadow = true
  body.add(leftArm)
  
  // Right arm
  const rightArm = new THREE.Mesh(armGeometry, settings.clothing === "none" ? skinMaterial : topMaterial)
  rightArm.position.set(shoulderWidth * 0.5 + armRadius, torsoHeight / 2 + 0.4 * heightScale, 0)
  rightArm.rotation.z = -0.15
  rightArm.castShadow = true
  rightArm.receiveShadow = true
  body.add(rightArm)
  
  // Hands (spheres)
  const handRadius = 0.04 * weightScale
  const handGeometry = new THREE.SphereGeometry(handRadius, 12, 12)
  
  const leftHand = new THREE.Mesh(handGeometry, skinMaterial)
  leftHand.position.set(
    -shoulderWidth * 0.5 - armRadius - Math.sin(0.15) * armLength * 0.5,
    torsoHeight / 2 + 0.4 * heightScale - Math.cos(0.15) * armLength * 0.5 - armLength * 0.4,
    0
  )
  leftHand.castShadow = true
  body.add(leftHand)
  
  const rightHand = new THREE.Mesh(handGeometry, skinMaterial)
  rightHand.position.set(
    shoulderWidth * 0.5 + armRadius + Math.sin(0.15) * armLength * 0.5,
    torsoHeight / 2 + 0.4 * heightScale - Math.cos(0.15) * armLength * 0.5 - armLength * 0.4,
    0
  )
  rightHand.castShadow = true
  body.add(rightHand)
  
  // Feet (elongated spheres)
  const footGeometry = new THREE.CapsuleGeometry(0.04 * weightScale, 0.08, 8, 8)
  const footMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2c3e50,
    roughness: 0.9,
    metalness: 0.0
  })
  
  const leftFoot = new THREE.Mesh(footGeometry, footMaterial)
  leftFoot.position.set(-hipWidth * 0.25, -0.5 * heightScale - 0.02, 0.03)
  leftFoot.rotation.x = Math.PI / 2
  leftFoot.castShadow = true
  body.add(leftFoot)
  
  const rightFoot = new THREE.Mesh(footGeometry, footMaterial)
  rightFoot.position.set(hipWidth * 0.25, -0.5 * heightScale - 0.02, 0.03)
  rightFoot.rotation.x = Math.PI / 2
  rightFoot.castShadow = true
  body.add(rightFoot)
  
  // Neck connector (will be hidden under head)
  const neckGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.12, 12)
  const neck = new THREE.Mesh(neckGeometry, skinMaterial)
  neck.position.y = torsoHeight + 0.5 * heightScale + 0.06
  neck.castShadow = true
  body.add(neck)
  
  // Scale entire body
  body.scale.setScalar(heightScale)
  
  // Position body so feet are at y=0
  body.position.y = 0.5 * heightScale
  
  return body
}

export async function createAvatar({ userHeadUrl, morphs, body: bodySettings }: AvatarSettings) {
  let head: THREE.Group

  // Check if the user uploaded an image or used the camera (data URL or blob URL)
  const isImage = userHeadUrl.startsWith("data:image/") ||
                 (userHeadUrl.startsWith("blob:") && !userHeadUrl.endsWith(".glb"))
  
  // Check if user uploaded a GLB file (blob URL ending with .glb or a direct URL)
  const isGLB = userHeadUrl.endsWith(".glb") || 
                (userHeadUrl.startsWith("blob:") && userHeadUrl.includes(".glb"))

  if (isImage) {
    // Use a plain skin-toned head — no photo texture mapping
    head = createPlaceholderHead()
  } else if (isGLB || (!userHeadUrl.startsWith("data:") && !userHeadUrl.startsWith("blob:"))) {
    // Attempt to load as GLB file
    try {
      const userHead = await load(userHeadUrl)
      normalizeHead(userHead)
      head = userHead
    } catch {
      // GLB failed to load, use placeholder
      head = createPlaceholderHead()
    }
  } else {
    // Fallback to placeholder head
    head = createPlaceholderHead()
  }

  // Apply morphs to head if it has morph targets
  head.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.morphTargetInfluences) {
      applyMorphs(obj, morphs)
    }
  })

  // Create the full avatar with body
  const avatar = new THREE.Group()
  avatar.name = "FullAvatar"
  
  // Create and add body
  const bodyMesh = createBody(bodySettings)
  avatar.add(bodyMesh)
  
  // Position head on top of body
  const heightScale = 0.85 + (bodySettings.height * 0.3)
  const torsoTop = (0.5 + 0.5) * heightScale + 0.5 * heightScale + 0.12 // torso height + base position + neck
  
  // Scale and position head
  head.scale.setScalar(0.4) // Scale head to match body proportions
  head.position.y = torsoTop + 0.15
  
  avatar.add(head)

  return avatar
}

// Create a simple placeholder head when model fails to load
function createPlaceholderHead(): THREE.Group {
  const group = new THREE.Group()
  
  // Head sphere
  const headGeometry = new THREE.SphereGeometry(0.5, 32, 32)
  const headMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xd4a574,
    roughness: 0.7,
    metalness: 0.0
  })
  const headMesh = new THREE.Mesh(headGeometry, headMaterial)
  headMesh.name = "HeadMesh"
  headMesh.castShadow = true
  headMesh.receiveShadow = true
  group.add(headMesh)
  
  return group
}

// Create a head mesh that will receive a texture
function createTexturedHead(): THREE.Group {
  const group = new THREE.Group()
  
  // Create a more face-like geometry for better texture mapping
  // Using a sphere with UV mapping suitable for face textures
  const headGeometry = new THREE.SphereGeometry(0.5, 64, 64)
  const headMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, // White base to show texture colors accurately
    roughness: 0.6,
    metalness: 0.0
  })
  const headMesh = new THREE.Mesh(headGeometry, headMaterial)
  headMesh.name = "HeadMesh"
  headMesh.castShadow = true
  headMesh.receiveShadow = true
  group.add(headMesh)
  
  return group
}

// Load an image as a Three.js texture
async function loadImageTexture(imageUrl: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const texture = new THREE.Texture(img)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true
      resolve(texture)
    }
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = imageUrl
  })
}

// Apply a texture to the head mesh
function applyTextureToHead(head: THREE.Group, texture: THREE.Texture): void {
  head.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name === "HeadMesh") {
      const material = child.material as THREE.MeshStandardMaterial
      material.map = texture
      material.needsUpdate = true
    }
  })
}

// Create body-only preview (with placeholder head)
export function createBodyPreview(bodySettings: BodySettings): THREE.Group {
  const avatar = new THREE.Group()
  avatar.name = "BodyPreview"
  
  // Create and add body
  const bodyMesh = createBody(bodySettings)
  avatar.add(bodyMesh)
  
  // Add placeholder head
  const head = createPlaceholderHead()
  const heightScale = 0.85 + (bodySettings.height * 0.3)
  const torsoTop = (0.5 + 0.5) * heightScale + 0.5 * heightScale + 0.12
  
  head.scale.setScalar(0.4)
  head.position.y = torsoTop + 0.15
  
  avatar.add(head)
  
  return avatar
}
