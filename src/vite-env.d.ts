/// <reference types="vite/client" />

// 自定义环境变量类型声明（可选的外部 GLTF/GLB 机械臂模型地址）
interface ImportMetaEnv {
  readonly VITE_ROBOT_MODEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
