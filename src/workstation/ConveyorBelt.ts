import * as THREE from 'three';
import { LAYOUT } from './layout';
import { createBeltMaterial, createMetalMaterial, setShadows } from '../utils/materials';

/**
 * 传送带。
 * 匀速送料：物料方块挂在 beltRoot 下，通过滚动纹理表现皮带运动；
 * 挡块位于取料端，物料到达后停止等待机械臂取走。
 */
export class ConveyorBelt {
  readonly group = new THREE.Group();
  /** 物料挂载节点（与皮带一起滚动） */
  readonly beltRoot = new THREE.Group();
  /** 皮带材质，每帧偏移纹理实现滚动效果 */
  private readonly beltMaterial: THREE.MeshStandardMaterial;
  /** 送料速度（米/秒） */
  speed = 0.35;

  constructor() {
    const { beltWidth, beltLength, beltCenter, beltTopY } = LAYOUT;

    this.group.name = 'ConveyorBelt';
    this.group.position.set(beltCenter.x, 0, beltCenter.z);

    // ---------- 支架 ----------
    const frameMat = createMetalMaterial(0x6b7480, 0.55, 0.65);
    const legHeight = beltTopY - 0.06;
    const legGeo = new THREE.BoxGeometry(0.08, legHeight, 0.08);
    const legPositions: [number, number][] = [
      [-beltWidth / 2 - 0.02, -beltLength / 2 + 0.25],
      [beltWidth / 2 + 0.02, -beltLength / 2 + 0.25],
      [-beltWidth / 2 - 0.02, beltLength / 2 - 0.25],
      [beltWidth / 2 + 0.02, beltLength / 2 - 0.25]
    ];
    for (const [x, z] of legPositions) {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(x, legHeight / 2, z);
      this.group.add(leg);
    }

    // 两侧护栏
    const railGeo = new THREE.BoxGeometry(0.05, 0.12, beltLength);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, frameMat);
      rail.position.set(side * (beltWidth / 2 + 0.04), beltTopY + 0.06, 0);
      this.group.add(rail);
    }

    // ---------- 皮带（带可滚动的条纹纹理） ----------
    this.beltMaterial = createBeltMaterial();
    this.beltMaterial.map = this.createStripeTexture();
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(beltWidth, 0.08, beltLength),
      this.beltMaterial
    );
    belt.position.y = beltTopY - 0.04;
    this.group.add(belt);

    // 两端滚筒
    const rollerGeo = new THREE.CylinderGeometry(0.09, 0.09, beltWidth + 0.1, 20);
    for (const z of [-beltLength / 2, beltLength / 2]) {
      const roller = new THREE.Mesh(rollerGeo, frameMat);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(0, beltTopY - 0.04, z);
      this.group.add(roller);
    }

    // ---------- 挡块（取料端） ----------
    const stopper = new THREE.Mesh(
      new THREE.BoxGeometry(beltWidth + 0.16, 0.22, 0.06),
      createMetalMaterial(0xc0453b, 0.5, 0.5)
    );
    stopper.position.set(0, beltTopY + 0.11, LAYOUT.stopperZ - beltCenter.z);
    stopper.name = 'Stopper';
    this.group.add(stopper);

    this.group.add(this.beltRoot);
    setShadows(this.group);
  }

  /** 生成皮带条纹纹理（Canvas 程序化生成，无需外部资源） */
  private createStripeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#2b2f33';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#3a3f44';
    for (let y = 0; y < 64; y += 16) {
      ctx.fillRect(0, y, 64, 6);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 12);
    return texture;
  }

  /** 每帧推进皮带纹理（running=false 时冻结，暂停 / 手动模式生效） */
  update(delta: number, running: boolean): void {
    if (running && this.beltMaterial.map) {
      this.beltMaterial.map.offset.y -= this.speed * delta * 0.8;
    }
  }

  dispose(): void {
    this.beltMaterial.map?.dispose();
  }
}
