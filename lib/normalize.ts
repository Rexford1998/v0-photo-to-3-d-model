import * as THREE from "three"

export function normalizeHead(head: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(head)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  head.position.sub(center)

  const scale = 1.2 / size.y
  head.scale.setScalar(scale)

  head.rotation.y = Math.PI // fix orientation
}
