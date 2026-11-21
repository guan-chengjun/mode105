import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 渲染基础设施：渲染器、透视相机、OrbitControls 与窗口自适应。
 */
export class SceneSetup {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    // ---------- 渲染器：PBR + 软阴影 ----------
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    // ---------- 场景与雾效 ----------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfd0de);
    // 线性雾：远处工位自然淡入背景色，拉开空间层次
    this.scene.fog = new THREE.Fog(0xbfd0de, 12, 26);

    // ---------- 相机：斜俯视整机 ----------
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(6.2, 5.0, 7.6);
    this.camera.lookAt(0, 0.9, 0);

    // ---------- OrbitControls：旋转 / 缩放 / 平移 ----------
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.9, 0);
    this.controls.enableDamping = true; // 阻尼让操作更顺滑
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03; // 防止相机穿到地面以下

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /** 每帧更新控制器并渲染 */
  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /** 释放资源并移除 DOM 与事件监听，避免内存泄漏 */
  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
