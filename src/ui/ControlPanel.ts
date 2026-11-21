/**
 * 控制面板的 DOM 构建与事件绑定。
 * 纯 TypeScript 生成界面，不引入任何前端框架。
 */
import type { JointInfo } from '../robot/types';
import type { SimulationStats } from '../SortingSimulation';

/** 面板向外抛出的事件集合 */
export interface PanelEvents {
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onModeChange: (mode: 'auto' | 'manual') => void;
  onJointChange: (index: number, angleDeg: number) => void;
  onWireframeToggle: (enabled: boolean) => void;
  onAxesToggle: (enabled: boolean) => void;
}

interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

const MAX_LOG_ROWS = 60;

export class ControlPanel {
  readonly root: HTMLElement;
  private readonly events: PanelEvents;
  private readonly jointSliders: HTMLInputElement[] = [];
  private readonly jointValueLabels: HTMLSpanElement[] = [];

  // 状态显示元素
  private readonly actionEl: HTMLElement;
  private readonly sortedEl: HTMLElement;
  private readonly cycleEl: HTMLElement;
  private readonly passEl: HTMLElement;
  private readonly inspectEl: HTMLElement;
  private readonly fpsEl: HTMLElement;
  private readonly modeEl: HTMLElement;
  private readonly modelEl: HTMLElement;
  private readonly logBody: HTMLElement;
  private readonly manualSection: HTMLElement;
  private readonly logs: LogEntry[] = [];

  constructor(events: PanelEvents, jointInfos: JointInfo[]) {
    this.events = events;
    this.root = document.createElement('div');
    this.root.className = 'control-panel';
    this.root.innerHTML = this.template();

    this.actionEl = this.require('#stat-action');
    this.sortedEl = this.require('#stat-sorted');
    this.cycleEl = this.require('#stat-cycle');
    this.passEl = this.require('#stat-pass');
    this.inspectEl = this.require('#stat-inspect');
    this.fpsEl = this.require('#stat-fps');
    this.modeEl = this.require('#stat-mode');
    this.modelEl = this.require('#stat-model');
    this.logBody = this.require('#log-body');
    this.manualSection = this.require('#manual-section');

    this.bindButtons();
    this.buildJointSliders(jointInfos);
  }

  private require(selector: string): HTMLElement {
    const el = this.root.querySelector(selector);
    if (!el) throw new Error(`UI 元素缺失：${selector}`);
    return el as HTMLElement;
  }

  private template(): string {
    return `
      <div class="panel-header">
        <h1>机械臂分拣工作站</h1>
        <div class="sub">Three.js · 工业 3D 仿真</div>
      </div>

      <section class="card">
        <h2>运行控制</h2>
        <div class="btn-row">
          <button id="btn-start" class="btn btn-primary">启动</button>
          <button id="btn-pause" class="btn">暂停</button>
          <button id="btn-reset" class="btn btn-danger">重置</button>
        </div>
        <div class="mode-row">
          <label><input type="radio" name="mode" value="auto" checked /> 自动模式</label>
          <label><input type="radio" name="mode" value="manual" /> 手动模式</label>
        </div>
      </section>

      <section class="card">
        <h2>实时状态</h2>
        <ul class="stat-list">
          <li><span>当前动作</span><b id="stat-action" class="stat-action">待机</b></li>
          <li><span>运行模式</span><b id="stat-mode">自动</b></li>
          <li><span>分拣数量</span><b id="stat-sorted">0</b></li>
          <li><span>循环次数</span><b id="stat-cycle">0</b></li>
          <li><span>合格件</span><b id="stat-pass" class="tag tag-pass">0</b></li>
          <li><span>待检件</span><b id="stat-inspect" class="tag tag-inspect">0</b></li>
          <li><span>FPS</span><b id="stat-fps">0</b></li>
          <li><span>模型来源</span><b id="stat-model" class="model-src">-</b></li>
        </ul>
      </section>

      <section class="card" id="manual-section" hidden>
        <h2>手动关节控制</h2>
        <div id="joint-sliders"></div>
      </section>

      <section class="card">
        <h2>显示选项</h2>
        <label class="check-row"><input type="checkbox" id="chk-wireframe" /> 线框模式</label>
        <label class="check-row"><input type="checkbox" id="chk-axes" /> 坐标轴辅助线</label>
      </section>

      <section class="card log-card">
        <h2>事件日志</h2>
        <div id="log-body" class="log-body"></div>
      </section>
    `;
  }

  private bindButtons(): void {
    this.require('#btn-start').addEventListener('click', () => this.events.onStart());
    this.require('#btn-pause').addEventListener('click', () => this.events.onPause());
    this.require('#btn-reset').addEventListener('click', () => this.events.onReset());

    this.root.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const mode = radio.value === 'manual' ? 'manual' : 'auto';
        this.manualSection.hidden = mode !== 'manual';
        this.events.onModeChange(mode);
      });
    });

    this.require('#chk-wireframe').addEventListener('change', (e) => {
      this.events.onWireframeToggle((e.target as HTMLInputElement).checked);
    });
    this.require('#chk-axes').addEventListener('change', (e) => {
      this.events.onAxesToggle((e.target as HTMLInputElement).checked);
    });
  }

  /** 按关节限位生成滑杆 */
  private buildJointSliders(jointInfos: JointInfo[]): void {
    const container = this.require('#joint-sliders');
    jointInfos.forEach((info, index) => {
      const row = document.createElement('div');
      row.className = 'slider-row';
      row.innerHTML = `
        <div class="slider-head">
          <span>${info.name}</span>
          <span class="slider-value">0°</span>
        </div>
        <input type="range" min="${info.minDeg}" max="${info.maxDeg}" step="1" value="0" />
      `;
      const slider = row.querySelector('input') as HTMLInputElement;
      const valueLabel = row.querySelector('.slider-value') as HTMLSpanElement;
      slider.addEventListener('input', () => {
        valueLabel.textContent = `${slider.value}°`;
        this.events.onJointChange(index, Number(slider.value));
      });
      this.jointSliders.push(slider);
      this.jointValueLabels.push(valueLabel);
      container.appendChild(row);
    });
  }

  /** 同步滑杆位置（初始化 / 重置时使用） */
  syncJointSliders(anglesDeg: number[]): void {
    anglesDeg.forEach((angle, i) => {
      if (!this.jointSliders[i]) return;
      this.jointSliders[i].value = String(Math.round(angle));
      this.jointValueLabels[i].textContent = `${Math.round(angle)}°`;
    });
  }

  /** 每帧刷新状态显示 */
  updateStats(stats: SimulationStats, fps: number): void {
    this.actionEl.textContent = stats.actionLabel;
    this.actionEl.dataset.phase = stats.phase;
    this.sortedEl.textContent = String(stats.sortedCount);
    this.cycleEl.textContent = String(stats.cycleCount);
    this.passEl.textContent = String(stats.passCount);
    this.inspectEl.textContent = String(stats.inspectCount);
    this.fpsEl.textContent = String(fps);
    this.modeEl.textContent = stats.mode === 'auto' ? '自动' : '手动';
    this.modelEl.textContent = stats.modelSource;
    this.modelEl.title = stats.modelSource;
  }

  /** 追加一条日志 */
  appendLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour12: false });
    this.logs.push({ time, message, level });
    if (this.logs.length > MAX_LOG_ROWS) this.logs.shift();
    this.renderLogs();
  }

  private renderLogs(): void {
    this.logBody.innerHTML = this.logs
      .map(
        (entry) =>
          `<div class="log-row log-${entry.level}">
             <span class="log-time">${entry.time}</span>${entry.message}
           </div>`
      )
      .join('');
    this.logBody.scrollTop = this.logBody.scrollHeight;
  }

  /** 清空日志（重置时使用） */
  clearLogs(): void {
    this.logs.length = 0;
    this.logBody.innerHTML = '';
  }
}
