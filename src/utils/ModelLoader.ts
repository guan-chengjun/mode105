import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** 模型加载结果 */
export interface GltfLoadResult {
  gltf: GLTF;
  /** 按 1~6 关节顺序匹配到的节点（未匹配项为 null） */
  jointNodes: (THREE.Object3D | null)[];
}

/**
 各关节在 GLTF 节点命名中的候选关键字（小写包含匹配，不区分大小写）。
 允许外部模型使用不同命名规范，只要名字中包含关键字即可被识别。
 */
const JOINT_NAME_CANDIDATES: string[][] = [
  ['joint1', 'j1', 'base_link', 'base_joint', 'joint_base', 'waist', 'rotation_base'],
  ['joint2', 'j2', 'shoulder', 'joint_shoulder'],
  ['joint3', 'j3', 'elbow', 'joint_elbow'],
  ['joint4', 'j4', 'wrist1', 'wrist_1', 'wrist_pitch', 'forearm'],
  ['joint5', 'j5', 'wrist2', 'wrist_2', 'wrist_yaw'],
  ['joint6', 'j6', 'wrist3', 'wrist_3', 'flange', 'tcp', 'end_effector', 'gripper']
];

/**
 * 带超时控制的 GLTF/GLB 加载器。
 * 加载失败（网络错误、解析失败、超时）一律抛异常，由上层执行几何体降级。
 */
export class ModelLoader {
  private readonly loader = new GLTFLoader();

  /**
   * @param url 模型地址
   * @param timeoutMs 超时时间，默认 10 秒
   */
  async load(url: string, timeoutMs = 10000): Promise<GltfLoadResult> {
    const gltf = await this.loadWithTimeout(url, timeoutMs);
    const jointNodes = this.matchJoints(gltf.scene);
    return { gltf, jointNodes };
  }

  private loadWithTimeout(url: string, timeoutMs: number): Promise<GLTF> {
    return new Promise<GLTF>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`模型加载超时（${timeoutMs}ms）：${url}`));
      }, timeoutMs);

      this.loader.load(
        url,
        (gltf) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(gltf);
        },
        undefined,
        (err) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      );
    });
  }

  /** 遍历模型节点，按名称关键字匹配六个关节 */
  private matchJoints(root: THREE.Object3D): (THREE.Object3D | null)[] {
    const all: THREE.Object3D[] = [];
    root.traverse((obj) => all.push(obj));

    return JOINT_NAME_CANDIDATES.map((candidates) => {
      for (const keyword of candidates) {
        const hit = all.find((obj) => obj.name.toLowerCase().includes(keyword));
        if (hit) return hit;
      }
      return null;
    });
  }
}
