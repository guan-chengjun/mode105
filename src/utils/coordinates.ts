import * as THREE from 'three';

/** 角度转弧度 */
export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/** 弧度转角度 */
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

/** 数值限幅 */
export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

/** 角度值限幅 */
export const clampDeg = (v: number, min: number, max: number): number =>
  clamp(v, min, max);

/** 线性插值 */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * 平滑加减速曲线（smoothstep）。
 * 起步与结束速度为 0，中段近似匀速，用于机械臂关节/末端的平滑运动。
 */
export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * 更平缓的五次平滑曲线（smootherstep），加减速更柔和。
 */
export const smootherstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** 构造 THREE.Vector3 的简写工具 */
export const vec3 = (x: number, y: number, z: number): THREE.Vector3 =>
  new THREE.Vector3(x, y, z);

/** 两点之间的水平距离（忽略 Y） */
export const horizontalDistance = (a: THREE.Vector3, b: THREE.Vector3): number =>
  Math.hypot(a.x - b.x, a.z - b.z);
