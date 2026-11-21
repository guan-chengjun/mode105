import * as THREE from 'three';
import { DEFAULT_JOINT_INFOS, type JointInfo, type RobotArm } from './types';
import { solveArmIK } from './ik';
import { clamp, degToRad, radToDeg } from '../utils/coordinates';
import { disposeObject, setShadows } from '../utils/materials';

/**
 * 外部 GLTF/GLB 机械臂包装器。
 *
 * 模型节点按名称关键字匹配到六个关节后，直接对关节节点施加 IK 求得的角度
 * （旋转轴约定与占位机械臂一致：关节 1/5/6 绕 Y，关节 2/3/4 绕 X）。
 * 若模型自身转轴方向不同，可在本类 axes 中按模型实际情况调整。
 */
export class GltfRobotArm implements RobotArm {
  readonly group = new THREE.Group();
  readonly joints: THREE.Object3D[] = [];
  readonly jointInfos: JointInfo[] = DEFAULT_JOINT_INFOS.map((j) => ({ ...j }));
  readonly isProcedural = false;
  readonly toolLength: number;
  endEffector: THREE.Object3D;

  private readonly anglesRad: number[] = new Array(6).fill(0);
  /** 模型中实际匹配到的关节数量（不足 6 时未匹配轴保持模型原姿态） */
  readonly matchedJointCount: number;

  constructor(sceneRoot: THREE.Object3D, jointNodes: (THREE.Object3D | null)[], toolLength: number) {
    this.toolLength = toolLength;
    this.group.add(sceneRoot);
    this.group.name = 'GltfRobotArm';

    for (let i = 0; i < 6; i++) {
      const node = jointNodes[i];
      if (node) {
        this.joints.push(node);
      } else {
        // 未匹配到的关节用一个空 Object3D 占位，保证索引对齐
        const dummy = new THREE.Object3D();
        dummy.name = `DummyJoint_${i + 1}`;
        this.group.add(dummy);
        this.joints.push(dummy);
      }
    }
    this.matchedJointCount = jointNodes.filter((n): n is THREE.Object3D => n !== null).length;

    // 末端吸附点：挂在第 6 关节下，按工具长度向下偏移；
    // 外部模型通常自带法兰/夹爪，偏移量取构型的工具长度以与逆解保持一致。
    this.endEffector = new THREE.Object3D();
    this.endEffector.name = 'EndEffectorMarker';
    this.endEffector.position.set(0, -toolLength, 0);
    this.joints[5].add(this.endEffector);

    setShadows(this.group);
  }

  getTipPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    this.group.updateWorldMatrix(true, true);
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
    for (let i = 0; i < 6; i++) {
      this.anglesRad[i] = solution.anglesRad[i];
    }
    this.applyAngles();
    return solution.reachable;
  }

  private applyAngles(): void {
    const axes: THREE.Vector3[] = [
      new THREE.Vector3(0, 1, 0), // J1 底座回转
      new THREE.Vector3(1, 0, 0), // J2 大臂俯仰
      new THREE.Vector3(1, 0, 0), // J3 肘部
      new THREE.Vector3(1, 0, 0), // J4 腕部俯仰
      new THREE.Vector3(0, 1, 0), // J5 腕部回转
      new THREE.Vector3(0, 1, 0)  // J6 法兰旋转
    ];
    for (let i = 0; i < 6; i++) {
      this.joints[i].rotation.set(0, 0, 0);
      this.joints[i].rotateOnAxis(axes[i], this.anglesRad[i]);
    }
    this.group.updateWorldMatrix(true, true);
  }

  dispose(): void {
    disposeObject(this.group);
  }
}
