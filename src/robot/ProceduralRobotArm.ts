import * as THREE from 'three';
import { DEFAULT_JOINT_INFOS, ROBOT_CONFIG, type JointInfo, type RobotArm } from './types';
import { solveArmIK } from './ik';
import { clamp, degToRad, radToDeg } from '../utils/coordinates';
import { createMetalMaterial, disposeObject, setShadows } from '../utils/materials';

/**
 * 占位几何体机械臂：当外部 GLTF/GLB 模型缺失或加载失败时使用。
 *
 * 关节层级（严格父子嵌套，父关节旋转带动所有子杆件）：
 * group
 *  └─ joint1（底座回转，绕 Y）
 *      └─ 基座立柱
 *      └─ joint2（大臂俯仰，绕 X）
 *          └─ 大臂 L2
 *          └─ joint3（肘部俯仰，绕 X）
 *              └─ 小臂 L3
 *              └─ joint4（腕部俯仰，绕 X）
 *                  └─ joint5（腕部回转，绕 Y）
 *                      └─ joint6（法兰旋转，绕 Y）
 *                          └─ 工具杆 L4 + 吸盘（endEffector 位于吸盘底面）
 */
export class ProceduralRobotArm implements RobotArm {
  readonly group = new THREE.Group();
  readonly joints: THREE.Group[] = [];
  readonly jointInfos: JointInfo[] = DEFAULT_JOINT_INFOS.map((j) => ({ ...j }));
  readonly isProcedural = true;
  readonly toolLength = ROBOT_CONFIG.toolLength;
  endEffector: THREE.Object3D;

  /** 每个关节当前角度（弧度） */
  private readonly anglesRad: number[] = new Array(6).fill(0);

  constructor() {
    const { baseHeight, l1, l2, l3, toolLength } = ROBOT_CONFIG;

    const matBody = createMetalMaterial(0xf2a03b, 0.42, 0.55); // 工业橙
    const matJoint = createMetalMaterial(0x3a4149, 0.5, 0.7); // 深灰关节
    const matTool = createMetalMaterial(0x54616e, 0.35, 0.8);

    // ---------- 固定底座 ----------
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, baseHeight, 32),
      matJoint
    );
    pedestal.position.y = baseHeight / 2;
    this.group.add(pedestal);

    const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.06, 32), matJoint);
    baseRing.position.y = baseHeight + 0.03;
    this.group.add(baseRing);

    // ---------- 关节1：底座回转 ----------
    const joint1 = new THREE.Group();
    joint1.position.y = baseHeight;
    this.group.add(joint1);
    this.joints.push(joint1);

    const column = new THREE.Mesh(new THREE.BoxGeometry(0.34, l1, 0.34), matBody);
    column.position.y = l1 / 2;
    joint1.add(column);

    // ---------- 关节2：大臂俯仰 ----------
    const joint2 = new THREE.Group();
    joint2.position.y = l1;
    joint1.add(joint2);
    this.joints.push(joint2);

    const shoulderCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 24), matJoint);
    shoulderCap.rotation.z = Math.PI / 2;
    joint2.add(shoulderCap);

    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.24, l2, 0.24), matBody);
    upperArm.position.y = l2 / 2;
    joint2.add(upperArm);

    // ---------- 关节3：肘部俯仰 ----------
    const joint3 = new THREE.Group();
    joint3.position.y = l2;
    joint2.add(joint3);
    this.joints.push(joint3);

    const elbowCap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.26, 24), matJoint);
    elbowCap.rotation.z = Math.PI / 2;
    joint3.add(elbowCap);

    const foreArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, l3, 0.18), matBody);
    foreArm.position.y = l3 / 2;
    joint3.add(foreArm);

    // ---------- 关节4：腕部俯仰 ----------
    const joint4 = new THREE.Group();
    joint4.position.y = l3;
    joint3.add(joint4);
    this.joints.push(joint4);

    const wristCap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), matJoint);
    joint4.add(wristCap);

    // ---------- 关节5：腕部回转（绕局部 Y） ----------
    const joint5 = new THREE.Group();
    joint4.add(joint5);
    this.joints.push(joint5);

    // ---------- 关节6：法兰旋转（绕局部 Y） ----------
    const joint6 = new THREE.Group();
    joint5.add(joint6);
    this.joints.push(joint6);

    // ---------- 工具杆 + 吸盘 ----------
    const toolRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, toolLength, 20),
      matTool
    );
    // IK 约定工具沿局部 -Y 下垂，故工具杆中心放在 -toolLength/2
    toolRod.position.y = -toolLength / 2;
    joint6.add(toolRod);

    const suctionCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.17, 0.1, 24),
      matTool
    );
    suctionCup.position.y = -toolLength - 0.05;
    joint6.add(suctionCup);

    // 末端吸附点：吸盘底面
    this.endEffector = new THREE.Object3D();
    this.endEffector.position.y = -toolLength - 0.1;
    joint6.add(this.endEffector);

    this.group.name = 'ProceduralRobotArm';
    setShadows(this.group);
  }

  getTipPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    return this.endEffector.getWorldPosition(target);
  }

  setJointAnglesDeg(anglesDeg: number[]): void {
    for (let i = 0; i < 6; i++) {
      const info = this.jointInfos[i];
      const limited = clamp(anglesDeg[i] ?? 0, info.minDeg, info.maxDeg);
      this.anglesRad[i] = degToRad(limited);
    }
    this.applyAngles();
  }

  getJointAnglesDeg(): number[] {
    return this.anglesRad.map(radToDeg);
  }

  solveIK(target: THREE.Vector3): boolean {
    const solution = solveArmIK(target, this.toolLength);
    this.anglesRad[0] = solution.anglesRad[0];
    this.anglesRad[1] = solution.anglesRad[1];
    this.anglesRad[2] = solution.anglesRad[2];
    this.anglesRad[3] = solution.anglesRad[3];
    this.anglesRad[4] = solution.anglesRad[4];
    this.anglesRad[5] = solution.anglesRad[5];
    this.applyAngles();
    return solution.reachable;
  }

  /** 将缓存的关节角写入旋转轴节点 */
  private applyAngles(): void {
    // 关节1/5/6 绕 Y 轴；关节2/3/4 绕 X 轴（与 IK 推导的转轴约定一致）
    const axes: THREE.Vector3[] = [
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 1, 0)
    ];
    for (let i = 0; i < 6; i++) {
      this.joints[i].rotation.set(0, 0, 0);
      this.joints[i].rotateOnAxis(axes[i], this.anglesRad[i]);
    }
  }

  dispose(): void {
    disposeObject(this.group);
  }
}
