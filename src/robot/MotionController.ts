import * as THREE from 'three';
import type { RobotArm } from './types';
import { smootherstep } from '../utils/coordinates';

/** 单段运动的句柄，可用于取消 */
export interface MotionHandle {
  done: Promise<void>;
  cancel: () => void;
}

/**
 * 末端运动控制器。
 *
 * 自动模式下所有动作都以「末端笛卡尔空间直线插值 + 加减速曲线」实现：
 * 每个周期把起点/终点位置交给机械臂逆解，关节角度随平滑曲线连续变化，
 * 从而在取料点、转运点、放料点之间获得柔和的加减速效果。
 */
export class MotionController {
  constructor(private readonly robot: RobotArm) {}

  /** 末端是否已到达目标点（吸附点距离阈值，单位米） */
  isAt(target: THREE.Vector3, tolerance = 0.02): boolean {
    const pos = this.robot.getTipPosition();
    return pos.distanceTo(target) <= tolerance;
  }

  /**
   * 让末端移动到 target。
   * @param target 末端吸附点世界坐标
   * @param duration 期望耗时（秒），传 0 则瞬移
   */
  moveTo(target: THREE.Vector3, duration: number): MotionHandle {
    let cancelled = false;
    let resolveDone: () => void = () => undefined;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    const start = this.robot.getTipPosition().clone();
    const end = target.clone();
    const elapsed = { value: 0 };

    if (duration <= 0) {
      this.robot.solveIK(end);
      resolveDone();
      return {
        done,
        cancel: () => {
          cancelled = true;
          resolveDone();
        }
      };
    }

    const update = (delta: number): boolean => {
      if (cancelled) return true;
      elapsed.value += delta;
      const raw = Math.min(1, elapsed.value / duration);
      const t = smootherstep(raw);
      const current = start.clone().lerp(end, t);
      this.robot.solveIK(current);
      if (raw >= 1) {
        this.robot.solveIK(end);
        return true;
      }
      return false;
    };

    this.activeUpdate = update;
    done.then(() => {
      if (this.activeUpdate === update) this.activeUpdate = null;
    });

    return {
      done,
      cancel: () => {
        cancelled = true;
        if (this.activeUpdate === update) this.activeUpdate = null;
        resolveDone();
      }
    };
  }

  /** 当前活动的每帧更新函数（由主循环驱动） */
  private activeUpdate: ((delta: number) => boolean) | null = null;

  /** 主循环调用：推进当前运动，返回 true 表示该段运动结束 */
  update(delta: number): boolean {
    if (!this.activeUpdate) return true;
    const finished = this.activeUpdate(delta);
    if (finished && this.activeUpdate) {
      this.activeUpdate = null;
    }
    return finished;
  }

  /** 是否正在执行运动 */
  get isMoving(): boolean {
    return this.activeUpdate !== null;
  }
}
