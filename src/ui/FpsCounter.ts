/**
 * FPS 统计器：基于滑动窗口平滑帧率，避免数字剧烈跳动。
 */
export class FpsCounter {
  private frames = 0;
  private elapsed = 0;
  private fps = 0;
  /** 刷新间隔（秒） */
  private readonly interval: number;

  constructor(interval = 0.5) {
    this.interval = interval;
  }

  /** 每帧调用，返回当前刷新周期内的平均 FPS */
  update(delta: number): number {
    this.frames += 1;
    this.elapsed += delta;
    if (this.elapsed >= this.interval) {
      this.fps = Math.round(this.frames / this.elapsed);
      this.frames = 0;
      this.elapsed = 0;
    }
    return this.fps;
  }

  get value(): number {
    return this.fps;
  }
}
