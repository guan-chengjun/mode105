import './ui/panel.css';
import * as THREE from 'three';
import { SceneSetup } from './scene/SceneSetup';
import { StationEnvironment } from './scene/StationEnvironment';
import { RobotFactory } from './robot/RobotFactory';
import { SortingSimulation } from './SortingSimulation';
import { Workstation } from './workstation/Workstation';
import { ControlPanel } from './ui/ControlPanel';
import { FpsCounter } from './ui/FpsCounter';
import { setWireframe } from './utils/materials';
import { DEFAULT_JOINT_INFOS } from './robot/types';

/**
 * 应用入口：
 * 初始化渲染器 / 场景 / 相机 -> 搭建工位环境 -> 加载机械臂（失败降级）->
 * 装配状态机与 UI -> 启动集中式动画循环。
 */
async function bootstrap(): Promise<void> {
  const appEl = document.getElementById('app');
  const uiRoot = document.getElementById('ui-root');
  if (!appEl || !uiRoot) throw new Error('缺少 #app 或 #ui-root 挂载节点');

  // ---------- 渲染基础设施 ----------
  const setup = new SceneSetup(appEl);
  const { scene } = setup;

  // ---------- 工位环境（地面 / 灯光 / 雾 / 货架等） ----------
  const environment = new StationEnvironment();
  scene.add(environment.group);

  // ---------- 工作站（传送带 / 料箱 / 物料） ----------
  const workstation = new Workstation();
  scene.add(workstation.group);

  // ---------- UI 面板（先创建，使模型加载日志可见） ----------
  const log = (message: string, level: 'info' | 'warn' | 'error' = 'info'): void => {
    panel.appendLog(message, level);
    // 同时输出到浏览器控制台，便于排查资源加载问题
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`[分拣工作站] ${message}`);
  };

  const panel = new ControlPanel(
    {
      onStart: () => sim?.start(),
      onPause: () => sim?.pause(),
      onReset: () => {
        sim?.reset();
        panel.clearLogs();
        if (sim) panel.syncJointSliders(sim.getJointAngles());
        log('工作站已重置', 'info');
      },
      onModeChange: (mode) => {
        sim?.setMode(mode);
        if (mode === 'manual' && sim) {
          panel.syncJointSliders(sim.getJointAngles());
        }
      },
      onJointChange: (index, angleDeg) => {
        if (!sim) return;
        const angles = sim.getJointAngles();
        angles[index] = angleDeg;
        sim.setManualJoints(angles);
      },
      onWireframeToggle: (enabled) => {
        // 对机械臂与工位全部业务模型切换线框（环境地面保持实体）
        setWireframe(robot.group, enabled);
        setWireframe(workstation.group, enabled);
      },
      onAxesToggle: (enabled) => environment.setAxesVisible(enabled)
    },
    DEFAULT_JOINT_INFOS
  );
  uiRoot.appendChild(panel.root);

  // ---------- 机械臂（GLTF 优先，失败自动降级几何体） ----------
  const factory = new RobotFactory();
  const build = await factory.create(log);
  const robot = build.robot;
  scene.add(robot.group);

  // ---------- 分拣状态机 ----------
  const sim = new SortingSimulation(robot, workstation, build.source, log);
  panel.syncJointSliders(robot.getJointAnglesDeg());
  log(`初始化完成，当前模型：${build.source}`, build.fallback ? 'warn' : 'info');

  // ---------- 动画循环（集中更新，避免分散的 requestAnimationFrame） ----------
  const clock = new THREE.Clock();
  const fpsCounter = new FpsCounter(0.5);
  let rafId = 0;
  let disposed = false;

  const animate = (): void => {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);

    // 限制单帧步长，页面切后台再回来时避免状态机大步长跳变
    const delta = Math.min(clock.getDelta(), 0.1);

    sim.update(delta);
    const fps = fpsCounter.update(delta);
    panel.updateStats(sim.getStats(), fps);

    setup.render();
  };
  animate();

  // ---------- 资源清理：页面卸载时释放 GPU 资源与事件监听 ----------
  window.addEventListener('beforeunload', () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    robot.dispose();
    workstation.dispose();
    setup.dispose();
  });
}

bootstrap().catch((err) => {
  console.error('应用启动失败：', err);
  const uiRoot = document.getElementById('ui-root');
  if (uiRoot) {
    uiRoot.innerHTML = `<div style="padding:24px;color:#b00020;font-family:sans-serif;">
      应用启动失败：${err instanceof Error ? err.message : String(err)}
    </div>`;
  }
});
