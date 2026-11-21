import * as THREE from 'three';
import { LAYOUT, type CubeType } from './layout';
import { ConveyorBelt } from './ConveyorBelt';
import { StorageBin } from './StorageBin';
import { StorageShelf } from './StorageShelf';
import { MaterialCube } from './MaterialCube';
import { disposeObject } from '../utils/materials';

/** 正在播放掉落动画的物料 */
interface FallingCube {
  cube: MaterialCube;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  elapsed: number;
  duration: number;
}

/**
 * 工作站：聚合传送带、料箱、货架与全部物料方块，
 * 负责物料的生成、输送、取放、掉落动画与重置。
 */
export class Workstation {
  readonly group = new THREE.Group();
  readonly conveyor = new ConveyorBelt();
  readonly passBin: StorageBin;
  readonly inspectBin: StorageBin;

  /** 传送带上的物料（含等待挡块的） */
  private readonly beltCubes: MaterialCube[] = [];
  /** 正在掉落的物料 */
  private readonly falling: FallingCube[] = [];
  /** 已入箱的物料（重置时统一释放） */
  private readonly allCubes: MaterialCube[] = [];

  private spawnTimer = 0;
  private readonly spawnInterval = 3.2;

  constructor() {
    this.group.name = 'Workstation';
    this.group.add(this.conveyor.group);

    this.passBin = new StorageBin('pass', LAYOUT.passBin, '合格区', 'rgba(34, 112, 68, 0.85)');
    this.inspectBin = new StorageBin(
      'inspect',
      LAYOUT.inspectBin,
      '待检区',
      'rgba(165, 95, 28, 0.85)'
    );
    this.group.add(this.passBin.group, this.inspectBin.group);

    // 两侧货架
    this.group.add(
      new StorageShelf(LAYOUT.shelfLeft.x, LAYOUT.shelfLeft.z).group,
      new StorageShelf(LAYOUT.shelfRight.x, LAYOUT.shelfRight.z).group
    );
  }

  /** 取料点世界坐标（挡块前方、皮带上方半个方块高度） */
  getPickPosition(): THREE.Vector3 {
    const s = LAYOUT.cubeSize;
    return new THREE.Vector3(0, LAYOUT.beltTopY + s / 2, LAYOUT.stopperZ);
  }

  /** 挡块处是否有等待取走的物料 */
  hasCubeAtStopper(): boolean {
    return this.beltCubes.some((c) => c.position.z <= LAYOUT.stopperZ + 0.001);
  }

  /** 取出挡块处的物料（从输送队列移除并返回） */
  takeStopperCube(): MaterialCube | null {
    const idx = this.beltCubes.findIndex((c) => c.position.z <= LAYOUT.stopperZ + 0.001);
    if (idx < 0) return null;
    const [cube] = this.beltCubes.splice(idx, 1);
    return cube;
  }

  /** 按物料类型取目标料箱 */
  getBin(type: CubeType): StorageBin {
    return type === 'pass' ? this.passBin : this.inspectBin;
  }

  /** 目标料箱是否已满 */
  isBinFull(type: CubeType): boolean {
    return this.getBin(type).isFull;
  }

  /**
   * 生成一个新物料并放到传送带远端。
   * 类型按 50% 概率随机分为合格 / 待检。
   */
  private spawnCube(): void {
    const type: CubeType = Math.random() < 0.5 ? 'pass' : 'inspect';
    const cube = new MaterialCube(type, LAYOUT.cubeSize);
    cube.mesh.position.set(0, LAYOUT.beltTopY + LAYOUT.cubeSize / 2, LAYOUT.spawnZ);
    this.conveyor.beltRoot.add(cube.mesh);
    this.beltCubes.push(cube);
    this.allCubes.push(cube);
  }

  /**
   * 释放物料：从机械臂末端摘下，播放落入目标料箱的动画。
   * @returns 动画结束后实际落入的槽位世界坐标
   */
  releaseIntoBin(cube: MaterialCube, type: CubeType): THREE.Vector3 {
    const bin = this.getBin(type);
    const target = bin.getNextSlotWorld(LAYOUT.cubeSize);

    // 先挂到工位根节点下（世界坐标保持不变），再做掉落动画
    cube.detachTo(this.group);
    const startPos = cube.position.clone();

    this.falling.push({
      cube,
      startPos,
      targetPos: target.clone(),
      elapsed: 0,
      duration: 0.7
    });
    bin.addCube(cube);
    return target;
  }

  /**
   * 每帧更新：生成物料、皮带输送、掉落动画。
   * @param delta 帧间隔（秒）
   * @param running 自动运行中才输送 / 生成；暂停与手动模式冻结
   */
  update(delta: number, running: boolean): void {
    this.conveyor.update(delta, running);

    if (running) {
      // 周期性生成物料
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnCube();
      }

      // 皮带匀速输送，到达挡块停止
      for (const cube of this.beltCubes) {
        if (cube.position.z > LAYOUT.stopperZ) {
          cube.position.z -= this.conveyor.speed * delta;
          if (cube.position.z < LAYOUT.stopperZ) {
            cube.position.z = LAYOUT.stopperZ;
          }
        }
      }
    }

    // 掉落动画（即使暂停也让在空物料落完，避免物料悬在空中）
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const item = this.falling[i];
      item.elapsed += delta;
      const t = Math.min(1, item.elapsed / item.duration);
      // 自由落体式缓动（二次曲线，模拟重力下坠）
      const fall = t * t;
      item.cube.position.lerpVectors(item.startPos, item.targetPos, fall);
      if (t >= 1) {
        item.cube.position.copy(item.targetPos);
        this.falling.splice(i, 1);
      }
    }
  }

  /** 重置：移除全部物料，清空料箱记录，恢复生成计时 */
  reset(): void {
    for (const cube of this.allCubes) {
      cube.mesh.removeFromParent();
      cube.dispose();
    }
    this.allCubes.length = 0;
    this.beltCubes.length = 0;
    this.falling.length = 0;
    this.passBin.reset();
    this.inspectBin.reset();
    this.spawnTimer = 0;
  }

  dispose(): void {
    this.reset();
    this.conveyor.dispose();
    disposeObject(this.group);
  }
}
