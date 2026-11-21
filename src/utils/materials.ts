import * as THREE from 'three';

/**
 * 材质工具：集中创建 PBR 标准材质，统一管理便于线框模式切换与释放。
 */

/** 金属漆面材质（机械臂主体） */
export function createMetalMaterial(color: number, roughness = 0.45, metalness = 0.6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/** 哑光塑料 / 涂装材质（料箱、物料方块） */
export function createPlasticMaterial(color: number, roughness = 0.7): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
}

/** 地面材质 */
export function createFloorMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x9aa3ad,
    roughness: 0.9,
    metalness: 0.0
  });
}

/** 传送带皮带材质 */
export function createBeltMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x2b2f33,
    roughness: 0.95,
    metalness: 0.1
  });
}

/**
 * 递归切换整个 Object3 层级下所有网格的线框模式。
 * 仅对具备 wireframe 属性的标准材质生效。
 */
export function setWireframe(root: THREE.Object3D, enabled: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        const std = mat as THREE.MeshStandardMaterial;
        if ('wireframe' in std) {
          std.wireframe = enabled;
          std.needsUpdate = true;
        }
      }
    }
  });
}

/** 递归释放几何体与材质，避免重置 / 销毁时的显存泄漏 */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        mat.dispose();
      }
    }
  });
}

/** 递归开启 / 关闭阴影投射与接收 */
export function setShadows(root: THREE.Object3D, cast = true, receive = true): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
    }
  });
}
