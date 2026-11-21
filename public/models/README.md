# 模型目录

将六轴机械臂模型放到本目录并命名为 `robot.glb`（或 `robot.gltf`），
启动后会自动加载并替换占位几何体机械臂。

## 关节命名要求

模型的六个关节节点名称中需要包含以下关键字（不区分大小写，包含即可匹配）：

| 关节 | 可识别的名称关键字 |
| ---- | ------------------ |
| 关节1 底座回转 | `joint1`、`j1`、`base_link`、`base_joint`、`waist` |
| 关节2 大臂俯仰 | `joint2`、`j2`、`shoulder` |
| 关节3 肘部俯仰 | `joint3`、`j3`、`elbow` |
| 关节4 腕部俯仰 | `joint4`、`j4`、`wrist1`、`wrist_pitch` |
| 关节5 腕部回转 | `joint5`、`j5`、`wrist2`、`wrist_yaw` |
| 关节6 法兰旋转 | `joint6`、`j6`、`wrist3`、`flange`、`tcp`、`gripper` |

旋转轴约定：关节 1/5/6 绕 Y 轴，关节 2/3/4 绕 X 轴。
若模型转轴方向不同，可在 `src/robot/GltfRobotArm.ts` 的 `applyAngles()` 中调整。

## 其他加载方式

- URL 参数：`http://localhost:5173/?robotModel=https://example.com/arm.glb`
- 环境变量：在项目根目录创建 `.env`，写入 `VITE_ROBOT_MODEL_URL=/models/my-robot.glb`

加载失败（文件缺失、网络错误、超时、关节匹配不全）时会自动降级为占位几何体机械臂，
并在界面日志区与浏览器控制台输出明确提示，仿真功能不受影响。
