import * as THREE from 'three';

/**
 * 机械臂构型常量（单位：米）。
 * 占位几何体机械臂严格按此尺寸搭建；外部 GLTF 模型通过逆解驱动时也复用该构型，
 * 因此替换模型时应选择尺寸接近的六轴机械臂，或在此处调整参数。
 */
export const ROBOT_CONFIG = {
  /** 底座高度（关节1 旋转中心离地高度） */
  baseHeight: 0.35,
  /** 肩关节相对关节1 的高度（L1） */
  l1: 0.45,
  /** 大臂长度（L2，肩 -> 肘） */
  l2: 0.9,
  /** 小臂长度（L3，肘 -> 腕） */
  l3: 0.8,
  /** 腕到末端吸附点的工具长度（L4） */
  toolLength: 0.45
} as const;

/** 单个关节的描述信息（UI 滑杆用） */
export interface JointInfo {
  /** 关节名称 */
  name: string;
  /** 角度下限（度） */
  minDeg: number;
  /** 角度上限（度） */
  maxDeg: number;
}

/** 六个关节的默认限位 */
export const DEFAULT_JOINT_INFOS: JointInfo[] = [
  { name: '关节1 · 底座回转', minDeg: -170, maxDeg: 170 },
  { name: '关节2 · 大臂俯仰', minDeg: -60, maxDeg: 110 },
  { name: '关节3 · 肘部俯仰', minDeg: -130, maxDeg: 130 },
  { name: '关节4 · 腕部俯仰', minDeg: -120, maxDeg: 120 },
  { name: '关节5 · 腕部回转', minDeg: -170, maxDeg: 170 },
  { name: '关节6 · 法兰旋转', minDeg: -180, maxDeg: 180 }
];

/**
 * 机械臂统一接口。
 * 占位几何体机械臂与外部 GLTF 机械臂均实现该接口，
 * 使运动学、状态机与 UI 层不关心模型来源。
 */
export interface RobotArm {
  /** 添加到场景中的根节点 */
  readonly group: THREE.Group;
  /** 六个可旋转关节（旋转轴节点） */
  readonly joints: THREE.Object3D[];
  /** 关节限位与名称 */
  readonly jointInfos: JointInfo[];
  /** 末端吸附点节点（吸盘 / 法兰中心） */
  readonly endEffector: THREE.Object3D;
  /** 是否为降级的几何体机械臂 */
  readonly isProcedural: boolean;
  /** 工具长度（腕 -> 末端） */
  readonly toolLength: number;

  /** 获取末端吸附点的世界坐标 */
  getTipPosition(target?: THREE.Vector3): THREE.Vector3;
  /** 直接设置六个关节角度（度），手动模式使用；自动按限位截断 */
  setJointAnglesDeg(anglesDeg: number[]): void;
  /** 读取当前六个关节角度（度） */
  getJointAnglesDeg(): number[];
  /** 逆运动学：驱动末端（吸附点）到达 target，保持工具竖直向下；返回是否成功 */
  solveIK(target: THREE.Vector3): boolean;
  /** 释放资源 */
  dispose(): void;
}
