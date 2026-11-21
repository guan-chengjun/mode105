/**
 * 工作站布局常量（单位：米）。
 * 机械臂基座位于世界原点，局部正前方为 -Z，传送带沿 Z 轴送料。
 */
export const LAYOUT = {
  /** 传送带顶面高度 */
  beltTopY: 0.55,
  /** 传送带宽度 / 长度 */
  beltWidth: 0.7,
  beltLength: 4.6,
  /** 传送带中心位置（从远端 +Z 向机械臂方向 -Z 送料） */
  beltCenter: { x: 0, z: 0.75 },
  /** 挡块 / 取料点的 Z 坐标 */
  stopperZ: -1.55,
  /** 物料生成位置（传送带远端） */
  spawnZ: 3.0,
  /** 物料方块边长 */
  cubeSize: 0.22,

  /** 合格区料箱位置与尺寸 */
  passBin: { x: -1.35, z: -0.35, w: 0.9, d: 0.9, h: 0.85 },
  /** 待检区料箱位置与尺寸 */
  inspectBin: { x: 1.35, z: -0.35, w: 0.9, d: 0.9, h: 0.85 },
  /** 每个料箱容量（2×2 堆叠位） */
  binCapacity: 4,

  /** 两侧货架位置 */
  shelfLeft: { x: -3.1, z: 0.2 },
  shelfRight: { x: 3.1, z: 0.2 }
} as const;

/** 物料类型 */
export type CubeType = 'pass' | 'inspect';

export const CUBE_COLORS: Record<CubeType, number> = {
  pass: 0x3fae5a, // 合格：绿色
  inspect: 0xe08a2e // 待检：橙色
};

export const CUBE_TYPE_LABELS: Record<CubeType, string> = {
  pass: '合格件',
  inspect: '待检件'
};
