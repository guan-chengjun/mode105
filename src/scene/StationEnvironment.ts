import * as THREE from 'three';
import { createFloorMaterial, createMetalMaterial } from '../utils/materials';

/**
 * 工位环境：地面网格、安全围栏框、灯光（环境光 + 平行光软阴影）与坐标轴辅助线。
 */
export class StationEnvironment {
  readonly group = new THREE.Group();
  /** 坐标轴辅助线（可通过 UI 开关） */
  readonly axesHelper: THREE.AxesHelper;
  /** 主平行光，阴影相机参数在此配置 */
  private readonly directionalLight: THREE.DirectionalLight;

  constructor() {
    // ---------- 地面 ----------
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), createFloorMaterial());
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // 网格辅助线（独立于地面，颜色更浅）
    const grid = new THREE.GridHelper(30, 60, 0x5d6b7a, 0x8494a3);
    const gridMat = grid.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.55;
    grid.position.y = 0.002;
    this.group.add(grid);

    // ---------- 安全围栏框（四角立柱 + 顶边，不遮挡视线） ----------
    const fenceMat = createMetalMaterial(0xd8b03a, 0.5, 0.4);
    const fenceW = 4.6;
    const fenceD = 5.6;
    const fenceH = 2.6;
    const postGeo = new THREE.CylinderGeometry(0.035, 0.035, fenceH, 12);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, fenceMat);
        post.position.set((sx * fenceW) / 2, fenceH / 2, (sz * fenceD) / 2);
        this.group.add(post);
      }
    }
    const topBarX = new THREE.BoxGeometry(fenceW, 0.04, 0.04);
    const topBarZ = new THREE.BoxGeometry(0.04, 0.04, fenceD);
    for (const sz of [-1, 1]) {
      const bar = new THREE.Mesh(topBarX, fenceMat);
      bar.position.set(0, fenceH, (sz * fenceD) / 2);
      this.group.add(bar);
    }
    for (const sx of [-1, 1]) {
      const bar = new THREE.Mesh(topBarZ, fenceMat);
      bar.position.set((sx * fenceW) / 2, fenceH, 0);
      this.group.add(bar);
    }

    // ---------- 灯光 ----------
    // 环境光：整体补光，避免阴影面死黑
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.group.add(ambient);

    // 半球光：天空 / 地面双色环境反射，提升 PBR 质感
    const hemi = new THREE.HemisphereLight(0xddeeff, 0x7a7064, 0.35);
    this.group.add(hemi);

    // 平行光：主光源，投射软阴影
    this.directionalLight = new THREE.DirectionalLight(0xfff4e0, 2.0);
    this.directionalLight.position.set(5.5, 9, 4.5);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    this.directionalLight.shadow.camera.near = 1;
    this.directionalLight.shadow.camera.far = 25;
    this.directionalLight.shadow.camera.left = -7;
    this.directionalLight.shadow.camera.right = 7;
    this.directionalLight.shadow.camera.top = 7;
    this.directionalLight.shadow.camera.bottom = -7;
    this.directionalLight.shadow.bias = -0.0004;
    this.directionalLight.shadow.radius = 4; // 软阴影半径（PCFSoft 下生效）
    this.group.add(this.directionalLight);
    this.group.add(this.directionalLight.target);

    // ---------- 坐标轴辅助线 ----------
    this.axesHelper = new THREE.AxesHelper(1.2);
    this.axesHelper.position.y = 0.01;
    this.axesHelper.visible = false;
    this.group.add(this.axesHelper);

    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh !== floor) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }

  setAxesVisible(visible: boolean): void {
    this.axesHelper.visible = visible;
  }
}
