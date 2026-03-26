import * as THREE from "three"

// Morph mappings could be more complex depending on the base head
// Here we map our simple UI morph states to actual morph target indices or names
export function applyMorphs(mesh: THREE.Mesh, morphs: Record<string, number>) {
  if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return

  // Example mappings from generic slider names to expected morph target names
  // e.g., morphs.faceWidth -> "Face_Width"

  const mapping: Record<string, string> = {
    faceWidth: "face_width",
    jawSize: "jaw_size",
    noseSize: "nose_size"
  }

  for (const [key, value] of Object.entries(morphs)) {
    const targetName = mapping[key] || key
    const targetIndex = mesh.morphTargetDictionary[targetName]

    // Some models might not have these specific names, so we can also
    // fall back to modifying indices directly for demonstration if desired
    if (targetIndex !== undefined) {
      mesh.morphTargetInfluences[targetIndex] = value
    }
  }
}
