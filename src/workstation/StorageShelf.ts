import * as THREE from 'three';
import { createMetalMaterial, createPlasticMaterial } from '../utils/materials';

/**
 * 工位两侧的仓储货架（装饰性环境元素，增强工作站氛围）。
 * 三层横梁结构，每层放置若干库存箱。
 */
export class StorageShelf {
  readonly group = new THREE.Group();

  constructor(x: number, z: number) {
    this.group.name = 'StorageShelf';
    this.group.position.set(x, 0, z);

    const frameMat = createMetalMaterial(0x4b5563, 0.5, 0.7);
    const width = 1.4;
    const depth = 0.7;
    const height = 2.4;
    const post = 0.07;

    // 四根立柱
    const postGeo = new THREE.BoxGeometry(post, height, post);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(postGeo, frameMat);
        p.position.set((sx * width) / 2, height / 2, (sz * depth) / 2);
        this.group.add(p);
      }
    }

    // 三层横梁 + 层板
    const beamMat = createMetalMaterial(0x5b6672, 0.55, 0.6);
    const shelfGeo = new THREE.BoxGeometry(width + post, 0.06, depth + post);
    const beamGeoFB = new THREE.BoxGeometry(width + post, 0.1, post);
    const layerYs = [0.5, 1.25, 2.0];
    for (const y of layerYs) {
      const shelf = new THREE.Mesh(shelfGeo, beamMat);
      shelf.position.y = y;
      this.group.add(shelf);

      for (const sz of [-1, 1]) {
        const beam = new THREE.Mesh(beamGeoFB, frameMat);
        beam.position.set(0, y + 0.08, (sz * depth) / 2);
        this.group.add(beam);
      }

      // 每层两个库存箱
      for (const sx of [-1, 1]) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.35, 0.45),
          createPlasticMaterial(sx < 0 ? 0x4a7fb5 : 0x8a6fb5, 0.8)
        );
        box.position.set((sx * width) / 4, y + 0.03 + 0.175, 0);
        this.group.add(box);
      }
    }

    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }
}
