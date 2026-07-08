# 热力图/气流图物理化 + UI 完整重设 — 设计文档

- 日期：2026-07-08
- 状态：已批准方向，待 spec 评审
- 相关：`docs/plans/2026-07-07-3d-house-platform-plan.md`（产品计划，本轮需同步更新）

## 1. 背景与目标

当前热力图与气流图"看起来复杂、底层却是简易 demo"：

- **热力图**：[`packages/simulation/src/interp/heatmap.ts`](../../../packages/simulation/src/interp/heatmap.ts) 只算 **6×6=36 格**，用反距离加权（IDW）从传感点插值，加一个 `row > gridSize/2` 的假日照。[`ThreeSceneCanvas.tsx:86`](../../../apps/web/src/components/Scene/ThreeSceneCanvas.tsx#L86) 再把 36 格在 CPU 上重采样成 384×384 贴图，画假等值线。渲染很花哨，但**底层场粗糙且不符合物理**——热量穿墙、无真实扩散、每次编辑全量重算贴图。
- **气流图**：[`packages/simulation/src/airflow/flow.ts`](../../../packages/simulation/src/airflow/flow.ts) **每房间只产出一个矢量**（一个方向+强度）。[`AirflowOverlay`](../../../apps/web/src/components/Scene/ThreeSceneCanvas.tsx#L506) 把它伪装成 3–5 条平行偏移的直线。没有真实流场、房间之间不通过门连通、无动画。
- **UI**：工作台布局已对齐计划（顶栏/左栏/3D 主台/右检查器/底栏），但右检查器"属性/文件/模板"页签是**不可点击的摆设 `<span>`**、全部堆在一个长滚动里；左栏用 H/F/◎ 文字按钮；图层开关在顶栏和左栏**重复**；底栏永远显示三块面板。

**目标**：把两张图从"伪装"升级为**真实但轻量、全部客户端运行**的计算可视化，并对 UI 做一次**完整视觉重设**。

## 2. 方向决策（已确认）

1. **可视化深度**：计算型物理-lite——用真实但轻量的求解器替换粗糙启发式。
2. **运动感**：混合——热力=静态平衡云图；气流=动画粒子。
3. **约束**：**无 GPU 服务器**，所有求解跑在浏览器（JS / Web Worker），渲染用浏览器自带 WebGL（react-three-fiber）。不依赖后端计算。
4. **UI**：完整视觉重设（结构修复 + 设计系统）。
5. **范围**：一个 spec 覆盖全部，分 A/B/C 三阶段一次做完；同步更新 plan 与 README。

## 3. 架构与模块边界

核心原则：**物理与渲染彻底解耦**。现在 `ThreeSceneCanvas.tsx`（977 行）既算物理又画图，职责混杂。

```
packages/simulation/src/
  grid/rasterize.ts        户型 → 网格（导热/通透系数图 + 内部掩码）
  heat/solveHeat.ts        稳态热扩散求解 → 温度场
  airflow/solveFlow.ts     势流/压力松弛求解 → 速度场
  summarize.ts             场 → 每房间可读摘要（供 DOM 面板）
  types.ts                 HeatField / FlowField / SimGrid 类型
  index.ts                 统一导出

apps/web/src/simulation/
  simulation.worker.ts     Web Worker：收到 layout → 调用求解器 → 回传 Float32Array
  useSimulation.ts         React hook：防抖、调度 worker、缓存结果

apps/web/src/components/Scene/
  ThreeSceneCanvas.tsx     只做装配（相机/光/地面/Controls + 各图层）
  layers/HeatLayer.tsx     DataTexture + ShaderMaterial（云图 + 真等值线）
  layers/AirflowLayer.tsx  粒子平流动画 + 静态流线
  layers/StructureLayer.tsx 房间/墙/开口/设备（从现有代码抽出）
  layers/CompassLayer.tsx  罗盘 + 九宫（从现有代码抽出，功能不变）
  shaders/                 GLSL 片段（热场着色、色带、等值线）
```

**否掉的替代**：主线程直接求解（编辑卡顿）；GPGPU 着色器解物理（当前无 drei/gpgpu，复杂度不值）。选 **Worker 里 JS 求解 + 约 50×40 网格**——算力足够、可单测、不卡 UI。

## 4. 数据模型变更

`packages/core` 新增（或在 `packages/simulation` 内部定义）：

```ts
interface SimGrid {
  cols: number; rows: number; cellSize: number;
  originX: number; originZ: number;         // 世界坐标原点（对齐 bounds）
  interior: Uint8Array;                      // 1=室内可见区
  conductivity: Float32Array;                // 热导：空地~1 / 墙~0.02 / 门洞~1 / 窗~0.5
  permeability: Float32Array;                // 流场通透：墙~0 / 空地~1 / 门~1 / 窗~1
}
interface HeatField { grid: SimGrid; temperature: Float32Array; min: number; max: number; }
interface FlowField {
  grid: SimGrid; vx: Float32Array; vy: Float32Array; speedMax: number;
  inlets: { x: number; y: number; strength: number }[];   // 供粒子重生
  streamlines: { points: [number, number][]; speed: number }[]; // 静态流线
}
```

- 保留每房间摘要类型（沿用现有 `HeatmapCell` 概念或新增 `RoomHeatSummary` / `RoomFlowSummary`）供底栏 DOM 显示可读数字。
- 需更新的消费方：`AppShell.tsx`、`HeatmapPanel.tsx`、`AirflowPanel.tsx`、`ThreeSceneCanvas.tsx`。旧的 `generateHeatmap`/`generateAirflow` 由基于场的实现替换。
- 后端 `backend/cfd/service.py` 等保持 stub，不在本轮范围。

## 5. 热力图模块

**栅格化**（`rasterize.ts`）：
- `cellSize = clamp(max(bounds.width, bounds.depth) / 56, 0.1, 0.3)`，得到约 50×40 网格。
- 每格判定：落在哪个房间（内部掩码）；是否墙体（格心到墙段距离 < thickness/2 且在段内，且不落在开口跨度内——门/窗在墙上"打洞"）。
- 导热系数 `conductivity`：空地/门洞=1.0，墙=0.02，窗=0.5，外墙格与室外耦合。

**求解**（`solveHeat.ts`，稳态松弛）：
- 初值取室外温度附近；传感点=定温约束（每次 sweep 后重置）。
- 源项：空调=冷源（拉向 `T-|delta|`），厨房=热源；朝南/西房间按 `orientation.facingDegrees` 加真实日照增益（替换 `row>gridSize/2` 假 hack）。
- 面导热用相邻格 conductivity 的**调和平均**，墙面几乎不交换 → **热量不再穿墙**，门洞让相邻房间连通。
- Jacobi/Gauss-Seidel 迭代 ~120 次或 `max|ΔT|<eps` 收敛；输出温度场 + min/max。

**渲染**（`HeatLayer.tsx`）：
- 温度场传 `THREE.DataTexture`（RedFormat + FloatType，Linear 过滤）。
- 地面平面用 `ShaderMaterial`：双线性采样 → 平滑连续云图（干掉 CPU 384² 循环）。
- 片元用 `fwidth` 画**真正的等温线**（抗锯齿），替换 `(intensity*8)%1` 摩尔纹。
- 色带沿用蓝→青→绿→黄→橙→红，用 **dataviz skill** 校准（可读性 + 色盲友好）。
- 用内部掩码裁到房间轮廓；可选轻微"呼吸"微动（uniform time，默认弱）。

## 6. 气流图模块

**求解**（`solveFlow.ts`，势流）：
- 同一网格上解 `∇·(k∇φ)=b`：迎风侧开口/空调出风=源，背风侧开口=汇（净零）；`k`=permeability，墙≈0 → **无通量边界**。
- 入口/出口判定：开口外法线与风向点积决定迎风/背风；强度 ∝ windSpeed·开口宽度。无风时由空调驱动，并允许任意两个外墙开口间的默认对流。空调=定向射流源；厨房=上升浮力。
- 同一松弛求解器迭代；`v=∇φ`（中心差分），得 vx/vy + speedMax。
- 从入口积分 ~16 条**静态流线**（供稳定路径参考）。

**渲染**（`AirflowLayer.tsx`，动画粒子）：
- 入口附近撒 ~800–1500 粒子；每帧双线性采样速度场、积分推进（RK2）；出界/低速滞留/超寿命 → 在随机入口重生。用 `THREE.Points`：按局部风速顶点着色、加色混合、软圆 sprite，带短拖尾。
- 叠加静态流线（细 tube，按速度着色）= 计划里的"地面流线"。
- 空调下方/厨房上方抬起部分粒子，表达**垂直环流**（计划要的"空间流动方向"）。
- 选中房间 → 该房间粒子更密、流线高亮。
- 入口/出口处保留半透明"流动面"（放在**真实开口位置**，不再是房间中心）。

## 7. UI 完整视觉重设

**结构性修复**：
- 右检查器**页签真正可切换**：`AppShell` 加 `inspectorTab` 状态，只渲染当前页；属性页内按计划顺序：房间→门窗→空调/厨房→温度点。
- 左栏换**内联 SVG 图标**（不引图标库，保持轻量）；**消除重复**：顶栏=三大分析图层（热力/气流/罗盘）+墙体；左栏=编辑工具（选择/画墙/加门窗/加设备/加温度点）。
- 底栏**跟随当前图层**显示对应读数；新增**常驻图例/色标**（热力色带 min/mid/max + 气流速度带，DOM 绘制，取代场景里难读的 3D sprite 图例）；可折叠。
- 新增精简**分析控件**：等值线开关、气流粒子密度/速度、动画播放/暂停。

**设计系统**：
- Token 梳理：把 `globals.css` 散值收敛为体系化 CSS 变量——分层背景（`--bg-0/1/2/3`）、文本层级（`--text/-muted/-faint`）、强调色（`--accent` + 语义色 `--heat/--flow/--fengshui`）、间距阶梯、字号阶梯、圆角/阴影 token，符合对比度可读性。
- 组件统一：按钮（主/次/开关态）、输入、pill、卡片、focus 态一致；克制的过渡（hover/切换/选中/面板开合）。

## 8. 性能与数据流

编辑 → 防抖 ~150ms → Worker 重算热场+流场 → 以 transferable `Float32Array` 回传 → 主线程更新 DataTexture / 粒子采样源。渲染每帧只做粒子平流（~1k 点 CPU 60fps）+ 一个贴图平面，开销低。
- 网格 56×40≈2240 格 ×120 次迭代 ×2 场 ≈ 50 万次运算，毫秒级。
- Worker 用 Next.js `new Worker(new URL('./simulation.worker.ts', import.meta.url))`，从 `@fengshui/simulation` 复用纯求解函数。

## 9. 文档更新（本轮交付）

- **更新 `docs/plans/2026-07-07-3d-house-platform-plan.md`**：把"简易 demo"表述改为物理-lite 求解；写明无 GPU 服务器、全客户端约束；反映三阶段实施与新 UI 设计系统；§4/§5 的实现方式对齐本 spec。
- **更新 `README.md`**：`packages/simulation` 描述由"计算 helpers"改为"客户端热扩散/流场求解器"；去掉"lightweight visualization-first / 非生产 three 渲染"的过时说明；补充"动画粒子流场 + 真实等温云图"能力与"无后端 GPU 依赖"。

## 10. 测试与验收

- `packages/simulation` 纯函数单测：
  - 墙阻隔——墙两侧温度存在断层（非连续）。
  - 门洞连通——同墙有门则两侧温度趋于连通。
  - 源汇——空调降温、厨房升温方向正确。
  - 流场——迎风开口为入、背风为出；无通量边界下墙内速度≈0。
- 保持 `npm run typecheck`、`npm run build`、后端测试通过。
- 对齐计划 §9：地面连续云图、真实等温线、气流可见地进/出/穿门、三图层独立显隐。

## 11. 分阶段实施

- **阶段 A**：`rasterize` + `solveHeat` + `HeatLayer` 着色器渲染 + 热场单测；`ThreeSceneCanvas` 拆出 `StructureLayer`/`CompassLayer`。
- **阶段 B**：`solveFlow` + `AirflowLayer` 粒子动画 + 流线 + 流场单测；接入 Worker + `useSimulation`。
- **阶段 C**：UI 设计系统 + 结构修复（可切换页签、SVG 图标、去重、跟随图层底栏、图例/控件）；更新 plan + README。

## 12. 非目标 / YAGNI

- 不做真正 Navier–Stokes / 瞬态 CFD。
- 不引入后端 GPU/计算。
- 不做多楼层 3D 热场。
- 不新增 drei/后处理依赖（除非零成本）。
- 罗盘/风水逻辑**功能不变**，仅抽出位置 + 套用新样式。

## 13. 风险与权衡

- **Float DataTexture 兼容性**：R3F 默认 WebGL2，支持 R32F；若个别环境不支持，降级为 8-bit 编码 + 着色器解码。
- **Worker 打包**：Next.js 15 支持 `import.meta.url` worker；若构建异常，退化为主线程求解（网格已足够小，可接受）。
- **粒子密度 vs 性能**：默认 ~1000，通过 UI 控件可调；低端设备自动降密度。
