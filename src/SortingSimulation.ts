import * as THREE from 'three';
import type { RobotArm } from './robot/types';
import { MotionController } from './robot/MotionController';
import { Workstation } from './workstation/Workstation';
import { LAYOUT, CUBE_TYPE_LABELS, type CubeType } from './workstation/layout';
import type { MaterialCube } from './workstation/MaterialCube';

/** 分拣流程的状态机阶段 */
export type SortingPhase =
  | 'idle' // 未启动
  | 'waiting' // 等待物料到达挡块
  | 'approaching' // 移动到取料点上方
  | 'picking' // 下降取料
  | 'lifting' // 取料后抬起
  | 'transferring' // 搬运到目标料箱上方（转运点）
  | 'placing' // 下降到释放高度
  | 'releasing' // 释放物料，等待落入箱内
  | 'returning' // 返回待命位
  | 'paused'; // 暂停

/** UI 展示用的中文动作名 */
export const PHASE_LABELS: Record<SortingPhase, string> = {
  idle: '待机',
  waiting: '等待',
  approaching: '取料',
  picking: '取料',
  lifting: '取料',
  transferring: '搬运',
  placing: '放置',
  releasing: '放置',
  returning: '搬运',
  paused: '已暂停'
};

/** 实时统计数据 */
export interface SimulationStats {
  phase: SortingPhase;
  actionLabel: string;
  sortedCount: number;
  cycleCount: number;
  passCount: number;
  inspectCount: number;
  running: boolean;
  mode: 'auto' | 'manual';
  modelSource: string;
}

/** 日志事件回调 */
export type LogHandler = (message: string, level: 'info' | 'warn' | 'error') => void;

/**
 * 分拣工作站状态机。
 *
 * 自动循环：等待物料 → 接近取料点 → 下降吸附 → 抬起 → 搬运转运 →
 *           下降放料 → 释放落箱 → 返回待命 → 进入下一轮。
 * 所有末端运动走 MotionController 的笛卡尔插值（加减速曲线），
 * 状态推进集中在 update() 内由主循环驱动，便于暂停与重置。
 */
export class SortingSimulation {
  private readonly robot: RobotArm;
  private readonly motion: MotionController;
  private readonly station: Workstation;
  private readonly log: LogHandler;

  phase: SortingPhase = 'idle';
  private mode: 'auto' | 'manual' = 'auto';
  private running = false;
  private phaseElapsed = 0;
  /** 当前阶段结束时触发的回调 */
  private phaseComplete: (() => void) | null = null;

  // 统计
  private sortedCount = 0;
  private cycleCount = 0;
  private passCount = 0;
  private inspectCount = 0;

  /** 当前被吸附的物料 */
  private heldCube: MaterialCube | null = null;
  /** 当前物料的目标类型 */
  private currentType: CubeType = 'pass';

  // 关键工位坐标（启动时按工作站布局计算）
  private readonly homePos: THREE.Vector3;
  private readonly pickPos: THREE.Vector3;
  private readonly pickApproachPos: THREE.Vector3;
  private readonly transferPos: THREE.Vector3;

  constructor(
    robot: RobotArm,
    station: Workstation,
    modelSource: string,
    log: LogHandler
  ) {
    this.robot = robot;
    this.station = station;
    this.log = log;
    this.motion = new MotionController(robot);
    this.modelSource = modelSource;

    this.pickPos = station.getPickPosition();
    // 取料点正上方的接近位
    this.pickApproachPos = this.pickPos.clone().add(new THREE.Vector3(0, 0.55, 0));
    // 转运点：机械臂正前方高位，搬运途中先抬升到这里再转向料箱
    this.transferPos = new THREE.Vector3(0, 1.75, -0.9);
    // 待命位：略前倾的高位
    this.homePos = new THREE.Vector3(0, 1.5, -1.05);

    // 初始姿态：逆解到待命位
    this.robot.solveIK(this.homePos);
  }

  /** 模型来源描述（UI 展示） */
  modelSource: string;

  // ---------------------------------------------------------------- 模式控制

  get isRunning(): boolean {
    return this.running;
  }

  get currentMode(): 'auto' | 'manual' {
    return this.mode;
  }

  /** 启动自动分拣 */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.mode = 'auto';
    if (this.phase === 'idle' || this.phase === 'paused') {
      this.enterPhase('waiting');
    }
    this.log('分拣流程已启动', 'info');
  }

  /** 暂停（冻结所有运动，保留当前阶段与已吸附物料） */
  pause(): void {
    if (!this.running) return;
    this.running = false;
    this.phase = 'paused';
    this.log('分拣流程已暂停', 'warn');
  }

  /** 切换自动 / 手动模式 */
  setMode(mode: 'auto' | 'manual'): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === 'manual') {
      // 进入手动：暂停自动流程，机械臂控制权交给滑杆
      this.running = false;
      this.phase = 'paused';
      this.log('已切换到手动模式，可用滑杆调节各关节角度', 'info');
    } else {
      this.log('已切换到自动模式，点击启动继续分拣', 'info');
      if (this.phase === 'paused') {
        this.phase = 'idle';
      }
    }
  }

  /** 手动模式下设置关节角度（度） */
  setManualJoints(anglesDeg: number[]): void {
    if (this.mode !== 'manual') return;
    this.robot.setJointAnglesDeg(anglesDeg);
  }

  /** 读取当前六个关节角度（度），供 UI 滑杆同步 */
  getJointAngles(): number[] {
    return this.robot.getJointAnglesDeg();
  }

  /** 重置到初始状态 */
  reset(): void {
    this.running = false;
    this.phaseComplete = null;
    this.heldCube = null;
    this.phaseElapsed = 0;
    this.sortedCount = 0;
    this.cycleCount = 0;
    this.passCount = 0;
    this.inspectCount = 0;
    this.station.reset();
    this.robot.solveIK(this.homePos);
    this.phase = 'idle';
    this.log('工作站已重置，统计数据清零', 'info');
  }

  // ---------------------------------------------------------------- 状态机

  /** 进入某个阶段并登记其完成回调（运动阶段由运动结束事件驱动） */
  private enterPhase(phase: SortingPhase, onComplete?: () => void): void {
    this.phase = phase;
    this.phaseElapsed = 0;
    this.phaseComplete = onComplete ?? null;
  }

  /**
   * 主循环更新入口。
   * @param delta 帧间隔（秒），暂停时传 0 以冻结运动
   */
  update(delta: number): void {
    // 工作站物料输送 / 生成 / 掉落
    this.station.update(delta, this.running && this.mode === 'auto');

    // 暂停或手动模式下不推进自动状态机
    if (!this.running || this.mode !== 'auto') return;

    this.phaseElapsed += delta;
    this.tickStateMachine(delta);
  }

  /** 状态机逐阶段推进 */
  private tickStateMachine(delta: number): void {
    switch (this.phase) {
      case 'waiting':
        this.tickWaiting();
        break;
      case 'approaching':
      case 'picking':
      case 'lifting':
      case 'transferring':
      case 'placing':
      case 'returning':
        this.tickMotionPhase(delta);
        break;
      case 'releasing':
        this.tickReleasing();
        break;
      default:
        break;
    }
  }

  /** 等待阶段：挡块出现物料后开始取料 */
  private tickWaiting(): void {
    if (!this.station.hasCubeAtStopper()) return;

    const cube = this.station.takeStopperCube();
    if (!cube) return;
    this.heldCube = cube;
    this.currentType = cube.type;
    this.log(
      `物料到达取料位，判定为「${CUBE_TYPE_LABELS[this.currentType]}」，开始取料`,
      'info'
    );

    // 先移动到取料点上方
    this.enterPhase('approaching', () => {
      // 再下降到吸附高度
      this.enterPhase('picking', () => {
        // 吸附物料：挂到末端节点上
        this.heldCube?.attachTo(this.robot.endEffector);
        this.log('真空吸盘已吸附物料', 'info');
        // 抬起
        this.enterPhase('lifting', () => this.beginTransfer());
        this.motion.moveTo(this.pickApproachPos, 0.8);
      });
      this.motion.moveTo(this.pickPos, 0.8);
    });
    this.motion.moveTo(this.pickApproachPos, 1.1);
  }

  /** 搬运阶段：经转运点前往目标料箱 */
  private beginTransfer(): void {
    const bin = this.station.getBin(this.currentType);
    const dropPos = bin.getDropPosition(LAYOUT.cubeSize);

    this.enterPhase('transferring', () => {
      this.log(
        `搬运至「${CUBE_TYPE_LABELS[this.currentType]}」料箱上方`,
        'info'
      );
      // 下降到释放高度
      this.enterPhase('placing', () => {
        // 释放物料，播放落箱动画
        if (this.heldCube) {
          this.station.releaseIntoBin(this.heldCube, this.currentType);
        }
        this.heldCube = null;
        this.sortedCount += 1;
        this.cycleCount += 1;
        if (this.currentType === 'pass') this.passCount += 1;
        else this.inspectCount += 1;
        this.log(
          `物料已释放并落入${CUBE_TYPE_LABELS[this.currentType]}料箱，累计分拣 ${this.sortedCount} 件`,
          'info'
        );
        // 等待落箱动画结束
        this.enterPhase('releasing', () => {
          // 返回待命位，进入下一轮
          this.enterPhase('returning', () => {
            this.enterPhase('waiting');
          });
          this.motion.moveTo(this.homePos, 1.2);
        });
      });
      this.motion.moveTo(dropPos, 0.8);
    });

    // 经转运点中转，避免弧线运动刮碰传送带与挡块
    this.motion.moveTo(this.transferPos, 1.4);
  }

  /** 通用运动阶段：由 MotionController 推进，运动结束触发阶段回调 */
  private tickMotionPhase(delta: number): void {
    const finished = this.motion.update(delta);
    if (finished) {
      const cb = this.phaseComplete;
      this.phaseComplete = null;
      cb?.();
    }
  }

  /** 释放阶段：等待落箱动画计时结束 */
  private tickReleasing(): void {
    if (this.phaseElapsed >= 0.75) {
      const cb = this.phaseComplete;
      this.phaseComplete = null;
      cb?.();
    }
  }

  // ---------------------------------------------------------------- 状态输出

  getStats(): SimulationStats {
    return {
      phase: this.phase,
      actionLabel: PHASE_LABELS[this.phase],
      sortedCount: this.sortedCount,
      cycleCount: this.cycleCount,
      passCount: this.passCount,
      inspectCount: this.inspectCount,
      running: this.running,
      mode: this.mode,
      modelSource: this.modelSource
    };
  }
}
