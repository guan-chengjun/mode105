import * as THREE from 'three';
import { ROBOT_CONFIG } from './types';
import { clamp, degToRad, radToDeg } from '../utils/coordinates';

/** 逆解输出：六个关节角度（弧度） */
export interface IKSolution {
  anglesRad: [number, number, number, number, number, number];
  /** 目标点是否在工作空间内（越限时会被截断到边界并返回 false） */
  reachable: boolean;
}

/**
 * 六轴机械臂解析逆解（前三轴决定位置，后三轴保持工具竖直向下）。
 *
 * 坐标系约定：
 * - 关节1 绕世界 Y 轴回转，机械臂局部正前方为 -Z；
 * - 关节2/3/4 绕局部 X 轴俯仰，杆件沿局部 +Y 方向生长；
 * - 腕部姿态约束为工具始终竖直向下，故 q5 = q6 = 0，
 *   q4 = -π/2 - (q2 + q3)，使腕后工具指向地面。
 *
 * @param tipTarget 末端吸附点的世界坐标
 * @param toolLength 腕中心到吸附点的长度
 */
export function solveArmIK(tipTarget: THREE.Vector3, toolLength: number): IKSolution {
  const { baseHeight, l1, l2, l3 } = ROBOT_CONFIG;

  // 1. 腕中心目标点：吸附点正上方 toolLength 处
  const wrist = new THREE.Vector3(tipTarget.x, tipTarget.y + toolLength, tipTarget.z);

  // 肩关节世界坐标
  const shoulder = new THREE.Vector3(0, baseHeight + l1, 0);

  // 2. 关节1：底座回转角（局部前向为 -Z，故用 atan2(x, -z)）
  const q1 = Math.atan2(wrist.x, -wrist.z);

  // 3. 转换到肩关节的局部二维平面（z 轴为水平前向，y 轴为竖直方向）
  const localZ = Math.hypot(wrist.x, wrist.z);
  const localY = wrist.y - shoulder.y;
  const r = Math.hypot(localZ, localY);

  // 4. 余弦定理求肘部角 q3（余弦值限幅，处理工作空间边界的浮点误差）
  const cosQ3 = (r * r - l2 * l2 - l3 * l3) / (2 * l2 * l3);
  const reachable = cosQ3 >= -1 && cosQ3 <= 1 && r > Math.abs(l2 - l3);
  const c3 = clamp(cosQ3, -1, 1);
  // 取负号：肘部上拱（elbow-up）构型，运动过程中姿态更自然
  const q3 = -Math.acos(c3);

  // 5. 肩关节角 q2：腕点极角减去肘部带来的偏置
  const phi = Math.atan2(localY, localZ);
  const elbowBias = Math.atan2(l3 * Math.sin(q3), l2 + l3 * Math.cos(q3));
  const q2 = phi - elbowBias;

  // 6. 腕部俯仰 q4：补偿大臂/小臂转角并额外旋转 -90°，使工具竖直向下
  const q4 = -Math.PI / 2 - (q2 + q3);

  // 工具保持竖直，末端两轴无需旋转
  const q5 = 0;
  const q6 = 0;

  return {
    anglesRad: [q1, q2, q3, q4, q5, q6],
    reachable
  };
}

/** 弧度数组转角度数组 */
export function radArrayToDeg(anglesRad: number[]): number[] {
  return anglesRad.map(radToDeg);
}

/** 角度数组转弧度数组 */
export function degArrayToRad(anglesDeg: number[]): number[] {
  return anglesDeg.map(degToRad);
}
