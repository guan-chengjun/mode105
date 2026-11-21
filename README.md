# 工业机械臂分拣工作站 · 3D 仿真

基于 **Three.js + Vite + TypeScript** 的浏览器端工业机械臂分拣工作站仿真。
六轴机械臂通过逆运动学驱动末端，在传送带、合格区 / 待检区料箱之间自动完成
「取料 → 搬运 → 放置」的循环分拣作业，支持自动 / 手动双模式与完整 UI 监控。

## 功能特性

- **六轴机械臂**：六个关节父子层级嵌套，支持正向运动学与解析逆解（IK）；
  末端在取料点、转运点、放料点之间做笛卡尔空间直线插值，带五次平滑加减速曲线。
- **分拣状态机**：传送带匀速送料 → 挡块停料 → 吸盘吸附 → 经转运点搬运 →
  料箱上方释放 → 物料重力落入箱内 → 自动循环；实时统计分拣数量、循环次数、合格 / 待检分类计数。
- **GLTF/GLB 模型加载与降级**：优先加载外部机械臂模型，按节点名称匹配六个关节；
  加载失败、超时或关节匹配不全时自动降级为占位几何体机械臂并给出明确提示。
- **工位环境**：地面网格、安全围栏、两侧三层货架、双料箱（带中文标签）、
  带挡块与滚动皮带的传送带、随机类型的物料方块。
- **交互控制**：OrbitControls 旋转 / 缩放 / 平移；自动 / 手动模式切换，
  手动模式下六个关节角度滑杆；启动、暂停、重置按钮。
- **视觉表现**：环境光 + 半球光 + 平行光 PCF 软阴影、PBR 标准材质、线性雾、
  线框模式开关、坐标轴辅助线开关。
- **UI 面板**：当前动作（等待 / 取料 / 搬运 / 放置）、分拣计数、循环次数、
  合格 / 待检件数、FPS、模型来源、滚动事件日志。

## 环境要求

- Node.js ≥ 18（开发与验证使用 Node.js 22）
- npm ≥ 9

## 安装与启动

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认自动打开 http://127.0.0.1:5173）
npm run dev

# 3. 类型检查 + 生产构建
npm run build

# 4. 本地预览生产构建
npm run preview
```

## 目录结构

```
mode105/
├── index.html                  # 页面入口，挂载 3D 视图与 UI 容器
├── package.json
├── tsconfig.json               # TypeScript 严格模式
├── vite.config.ts
├── public/
│   └── models/
│       └── README.md           # 外部 GLTF/GLB 模型放置说明
└── src/
    ├── main.ts                 # 入口：初始化渲染器/场景/相机，装配模块，动画循环
    ├── vite-env.d.ts           # 环境变量类型声明
    ├── SortingSimulation.ts    # 分拣流程状态机与统计数据
    ├── scene/
    │   ├── SceneSetup.ts       # WebGL 渲染器、透视相机、OrbitControls、雾效
    │   └── StationEnvironment.ts # 地面、网格、围栏、灯光、阴影、坐标轴
    ├── robot/
    │   ├── types.ts            # 机械臂接口、构型常量、关节限位
    │   ├── ik.ts               # 六轴解析逆运动学
    │   ├── ProceduralRobotArm.ts # 占位几何体机械臂（降级方案）
    │   ├── GltfRobotArm.ts     # 外部 GLTF 机械臂包装器
    │   ├── RobotFactory.ts     # 模型加载与降级决策
    │   └── MotionController.ts # 末端笛卡尔插值运动（加减速曲线）
    ├── workstation/
    │   ├── layout.ts           # 工位布局常量与物料类型
    │   ├── ConveyorBelt.ts     # 传送带、支架、挡块、滚动纹理
    │   ├── MaterialCube.ts     # 物料方块（吸附/释放/挂载切换）
    │   ├── StorageBin.ts       # 料箱（槽位管理、中文标签）
    │   ├── StorageShelf.ts     # 两侧仓储货架
    │   └── Workstation.ts      # 工位编排：物料生命周期与掉落动画
    ├── ui/
    │   ├── ControlPanel.ts     # 控制面板 DOM、滑杆、状态、日志
    │   ├── FpsCounter.ts       # 帧率统计
    │   └── panel.css           # 面板样式
    └── utils/
        ├── coordinates.ts      # 角度换算、限幅、插值、平滑曲线
        ├── materials.ts        # PBR 材质工厂、线框切换、资源释放
        ├── ModelLoader.ts      # 带超时的 GLTFLoader 与关节名称匹配
        └── labels.ts           # Canvas 中文文字标签
```

## 操作方式

1. 打开页面后默认处于自动模式待机状态，右上角面板点击 **启动** 开始分拣；
2. 鼠标左键拖动旋转视角，滚轮缩放，右键（或中键）平移；
3. **暂停** 冻结全部运动且保留现场，再次点击 **启动** 继续；
4. **重置** 清空所有物料与统计数据，机械臂回到待命位；
5. 切换到 **手动模式** 后，自动流程暂停，拖动六个关节滑杆可直接控制机械臂姿态；
6. 勾选 **线框模式** / **坐标轴辅助线** 可切换调试显示。

## 替换为真实机械臂模型

1. 将模型文件放到 `public/models/robot.glb`；
2. 确认关节节点命名包含约定关键字（见 `public/models/README.md`）；
3. 刷新页面即可。也可通过 URL 参数 `?robotModel=<地址>` 或
   `.env` 中的 `VITE_ROBOT_MODEL_URL` 指定其他地址。

模型尺寸建议接近默认构型（底座 0.35 m、大臂 0.9 m、小臂 0.8 m、工具 0.45 m），
否则需要同步调整 `src/robot/types.ts` 中的 `ROBOT_CONFIG`。

## 技术说明

- **逆运动学**：关节 1 由底座回转角解析求出；关节 2/3 由余弦定理求肘上构型
  （elbow-up）解；关节 4 补偿前两轴转角并保持工具竖直向下，关节 5/6 保持为 0。
- **状态机阶段**：`idle → waiting → approaching → picking → lifting →
  transferring → placing → releasing → returning → waiting（循环）`。
- **资源管理**：所有几何体 / 材质 / 纹理均实现 `dispose()`，页面卸载时统一释放；
  动画循环集中在单个 `requestAnimationFrame` 中，暂停时帧间隔不驱动状态机。
- **健壮性**：帧步长上限 0.1 s，防止页面切后台后状态机大步长跳变；
  模型加载带 10 s 超时，任何失败都有界面日志与控制台报错。
