import * as THREE from 'three';

/**
 * 用 Canvas 纹理生成中文文字标签面片，贴在料箱 / 设备前方。
 * 避免引入额外的字体加载器，浏览器内置中文字体即可渲染。
 */
export function createTextLabel(
  text: string,
  width = 0.8,
  height = 0.24,
  bgColor = 'rgba(20, 26, 34, 0.75)',
  fgColor = '#ffffff'
): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');

  // 圆角背景
  ctx.fillStyle = bgColor;
  roundRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 24);
  ctx.fill();

  // 文字
  ctx.fillStyle = fgColor;
  ctx.font = 'bold 72px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = `Label-${text}`;
  return mesh;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
