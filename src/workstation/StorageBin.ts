import * as THREE from 'three';
import { LAYOUT, type CubeType } from './layout';
import { createPlasticMaterial } from '../utils/materials';
import { createTextLabel } from '../utils/labels';
import type { MaterialCube } from './MaterialCube';

interface BinSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

/**
 * 分拣料箱（合格区 / 待检区）。
 * 四面围板 + 底板结构，内部按 2×2 槽位管理落入的物料，
 * 堆满后通知仿真暂停向该箱投放。
 */
export class StorageBin {
  readonly group = new THREE.Group();
  readonly type: CubeType;
  readonly capacity = LAYOUT.binCapacity;
  private readonly spec: BinSpec;
  private readonly stored: MaterialCube[] = [];

  constructor(type: CubeType, spec: BinSpec, labelText: string, labelColor: string) {
    this.type = type;
    this.spec = spec;
    this.group.name = `Bin-${type}`;
    this.group.position.set(spec.x, 0, spec.z);

    const wallMat = createPlasticMaterial(type === 'pass' ? 0x2e7d4f : 0xb56b23, 0.75);
    const thickness = 0.05;

    // 底板
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(spec.w, thickness, spec.d), wallMat);
    bottom.position.y = thickness / 2;
    this.group.add(bottom);

    // 四面围板
    const wallH = spec.h;
    const sideGeoLR = new THREE.BoxGeometry(thickness, wallH, spec.d);
    const sideGeoFB = new THREE.BoxGeometry(spec.w, wallH, thickness);
    for (const side of [-1, 1]) {
      const leftRight = new THREE.Mesh(sideGeoLR, wallMat);
      leftRight.position.set(side * (spec.w / 2 - thickness / 2), wallH / 2, 0);
      this.group.add(leftRight);

      const frontBack = new THREE.Mesh(sideGeoFB, wallMat);
      frontBack.position.set(0, wallH / 2, side * (spec.d / 2 - thickness / 2));
      this.group.add(frontBack);
    }

    // 前方中文标签（朝向机械臂一侧，即 +Z）
    const label = createTextLabel(labelText, spec.w * 0.8, 0.2, labelColor);
    label.position.set(0, wallH * 0.62, spec.d / 2 + thickness / 2 + 0.005);
    this.group.add(label);

    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }

  get count(): number {
    return this.stored.length;
  }

  get isFull(): boolean {
    return this.stored.length >= this.capacity;
  }

  /**
   * 计算下一个槽位的世界坐标（箱内 2×2 平铺，超过一层后向上堆叠）。
   */
  getNextSlotWorld(cubeSize: number): THREE.Vector3 {
    const index = this.stored.length;
    const perLayer = 4;
    const layer = Math.floor(index / perLayer);
    const slot = index % perLayer;
    const col = slot % 2;
    const row = Math.floor(slot / 2);

    const localX = (col === 0 ? -1 : 1) * (this.spec.w / 4);
    const localZ = (row === 0 ? -1 : 1) * (this.spec.d / 4);
    const y = 0.05 + cubeSize / 2 + layer * (cubeSize + 0.01);

    return new THREE.Vector3(this.spec.x + localX, y, this.spec.z + localZ);
  }

  /** 箱子开口中心的世界坐标（机械臂释放点） */
  getDropPosition(cubeSize: number): THREE.Vector3 {
    const slot = this.getNextSlotWorld(cubeSize);
    return new THREE.Vector3(slot.x, this.spec.h + cubeSize / 2 + 0.05, slot.z);
  }

  addCube(cube: MaterialCube): void {
    this.stored.push(cube);
  }

  reset(): void {
    this.stored.length = 0;
  }
}
