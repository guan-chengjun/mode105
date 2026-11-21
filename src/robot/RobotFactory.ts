import type { RobotArm } from './types';
import { ROBOT_CONFIG } from './types';
import { ProceduralRobotArm } from './ProceduralRobotArm';
import { GltfRobotArm } from './GltfRobotArm';
import { ModelLoader } from '../utils/ModelLoader';

/** 工厂创建结果，附带模型来源说明供 UI 日志展示 */
export interface RobotBuildResult {
  robot: RobotArm;
  /** 实际使用的模型来源描述 */
  source: string;
  /** 是否走了降级方案 */
  fallback: boolean;
}

/**
 * 机械臂工厂：
 * 1. 优先加载外部 GLTF/GLB 模型（环境变量 / URL 参数 / 默认 public 路径）；
 * 2. 任一环节失败则降级为占位几何体机械臂，并通过 onMessage 输出明确提示。
 */
export class RobotFactory {
  private readonly loader = new ModelLoader();

  async create(onMessage: (msg: string, level?: 'info' | 'warn' | 'error') => void): Promise<RobotBuildResult> {
    const url = this.resolveModelUrl();

    if (url) {
      try {
        onMessage(`开始加载机械臂模型：${url}`);
        const { gltf, jointNodes } = await this.loader.load(url);
        const matched = jointNodes.filter((n) => n !== null).length;

        if (matched < 6) {
          throw new Error(`模型仅匹配到 ${matched}/6 个关节节点，无法建立完整关节层级`);
        }

        const robot = new GltfRobotArm(gltf.scene, jointNodes, ROBOT_CONFIG.toolLength);
        onMessage(`GLTF 机械臂加载成功，已匹配全部 ${matched} 个关节`, 'info');
        return { robot, source: `GLTF 模型（${url}）`, fallback: false };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        onMessage(`机械臂模型加载失败：${reason}`, 'error');
        onMessage('已自动降级为占位几何体机械臂，仿真功能不受影响', 'warn');
      }
    } else {
      onMessage('未配置外部模型地址，使用占位几何体机械臂（可在 public/models 放置 robot.glb）', 'info');
    }

    const robot = new ProceduralRobotArm();
    return { robot, source: '占位几何体机械臂（降级模式）', fallback: true };
  }

  /** 解析模型地址优先级：URL 查询参数 > 环境变量 > public 默认路径 */
  private resolveModelUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('robotModel');
    if (fromQuery) return fromQuery;

    const fromEnv = import.meta.env.VITE_ROBOT_MODEL_URL;
    if (fromEnv) return fromEnv;

    // 默认尝试 public/models/robot.glb（文件不存在时会快速 404 并降级）
    return '/models/robot.glb';
  }
}
