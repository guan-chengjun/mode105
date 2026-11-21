import * as THREE from 'three';
import { CUBE_COLORS, type CubeType } from './layout';
import { createPlasticMaterial } from '../utils/materials';

/**
 * 物料方块。
 * 同时支持三种状态：在传送带上移动、被机械臂吸附（挂载到末端节点）、落入料箱。
 */
export class MaterialCube {
  readonly mesh: THREE.Mesh;
  readonly type: CubeType;

  constructor(type: CubeType, size: number) {
    this.type = type;
    const material = createPlasticMaterial(CUBE_COLORS[type], 0.55);
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = `Cube-${type}`;

    // 顶部加一圈浅色装饰边，增强立体感
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.mesh.geometry),
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.5 })
    );
    this.mesh.add(edge);
  }

  get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  /** 吸附到机械臂末端（改变父节点，保持世界变换不跳变） */
  attachTo(parent: THREE.Object3D): void {
    parent.attach(this.mesh);
  }

  /** 从机械臂释放到世界 / 料箱节点下 */
  detachTo(parent: THREE.Object3D): void {
    parent.attach(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const materials = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
    materials.forEach((m) => m.dispose());
  }
}
