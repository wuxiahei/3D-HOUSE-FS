# 3D HOUSE FS

## Productization status

- Runtime layout documents use `schemaVersion: 2`; unversioned/v1 imports are migrated through `@fengshui/core`.
- Browser simulation is authoritative for the current product. The FastAPI backend is experimental and no longer exposes duplicate heatmap/airflow simulation endpoints.
- Browser AI mode calls the configured provider directly from the browser, so the browser API key is not sent to the application server. Server AI remains a separate password-protected experimental path.
- The SketchUp-style editor now has tool modes for Select, Wall, Move, Door, Window, Device, and Measure. Push/Pull, arbitrary solid modeling, CAD/BIM import, multi-floor buildings, and engineering CFD remain out of scope.

3D HOUSE FS 是一个面向户型建模、室内热环境/气流仿真可视化和罗盘风水参考分析的 monorepo 原型项目。项目目标不是做静态展示页，而是提供一个可编辑、可分析、可视化联动的 3D 房屋工作台。

当前版本的热力/气流计算全部在客户端完成，不依赖后端 GPU 或远程 CFD 服务。AI 建模可通过 Next.js API 路由接入 OpenAI 兼容服务；未配置时会自动回落到本地启发式草案。后端保留 FastAPI stub，用于后续接入报告生成或更高精度仿真服务。

## 核心功能

### 户型编辑

- 模板化创建户型：紧凑两居、家庭三居等。
- 房间选择、尺寸和位置编辑。
- 自定义画墙、删除墙体。
- 添加门、窗、空调、厨房热源和温度传感点。
- 项目元数据、朝向、门向、天气参数配置。
- 本地布局保存/恢复能力。

### 3D 房屋模型

- 基于 Three.js / React Three Fiber 的交互式 3D 场景。
- 透明墙体、真实高度墙体、连接式屋顶/檐口。
- 房间、墙、门窗、设备、传感点的 3D 标识。
- 支持结构透明度和屋顶显示控制。
- 支持旋转、缩放、选择房间查看分析信息。

### 热力温度仿真图

热力图不再是简单插值贴图，而是基于客户端网格求解的 physics-lite 热场：

- 户型栅格化：房间、墙体、门窗、室内区域映射为计算网格。
- 稳态热扩散求解：墙体低导热、门洞连通、窗体弱连通。
- 传感点定温约束。
- 热源/冷源：厨房、空调、日照、室外温度。
- 与气流场轻量耦合：气流速度参与上风输运和通风换热。
- 多高度温度层：模拟近地面、中部、顶部的温度分层。
- 3D 可视化：
  - 水平温度切片
  - 可调横向/纵向垂直剖面
  - 显式等温线
  - 热通量方向线
  - 冷/热羽流
  - 温度传感点标注

### 室内气流仿真图

气流图基于 pressure-lite 势流/压力松弛模型，适合浏览器内轻量运行：

- 门窗根据风向生成入口/出口源汇。
- 空调和热源参与局部送风/浮力表达。
- 墙体作为不可穿透边界。
- 压力场求解后生成速度场。
- 输出压力、速度、涡量、散度、垂直速度和全空间种子点。
- 3D 可视化：
  - 压力底图
  - 密集 pathline 路径线
  - 速度 glyph
  - 动画粒子
  - 静态流线
  - 入口/出口流动面
  - 低速死角诊断区域

### 罗盘风水分析

风水模块提供信息参考，不直接给出吉凶结论：

- 3D 罗盘叠加在户型周围。
- 支持简洁/专业罗盘模式。
- 专业模式包含：
  - 八方扇区
  - 24 山
  - 八卦/九星内环
  - 朝向针
  - 门向针
  - 十字基准线
- 九宫映射房间中心点。
- 房间宫位、年星、门窗、冷热设备与热力/气流交叉解读。
- 底部风水面板显示当前宫位、关联房间和分析依据。

## 界面交互模型

工作台围绕单一 3D 主体组织，界面分区如下：

```text
顶部栏：项目名 / 三大模式切换 / 分析图层组 / 结构显隐 / 状态
左侧工具栏：选择、画墙、加门、加窗、空调、温度点（图标 + 文字标签）
中间：全尺寸 3D 主舞台
右侧检查器：分析控制（分析模式）+ 属性 / 文件 / 模板
底部功能区：当前模式的结果摘要
```

关键交互约定：

- **模式与图层解耦**：顶部每个分析图层是一个按钮组，主按钮负责“聚焦该分析”（切到分析模式并设为当前），右侧眼睛图标独立控制“显示 / 隐藏叠层”，互不干扰。可以在查看气流时单独关掉热力叠层，而不被切走当前分析。
- **单一控制区**：进入分析模式后，图层显示项、参数和图例集中显示在右侧检查器顶部；底部功能区只呈现结果摘要，右侧不再出现第二块控制区。
- **紧凑控制**：布尔显示项用 chip 按钮组表达，数值滑块折叠进“高级参数”，默认只露常用项。
- **移动端**：窄屏下右侧检查器变为可唤出的抽屉，通过浮动按钮打开，不再直接隐藏。
- **状态反馈**：仿真计算中顶部状态栏显示旋转指示；温度图例带 `°C` 刻度并与色带对齐。

## 技术栈

### 前端

- Next.js 15
- React 19
- TypeScript
- Three.js
- React Three Fiber
- CSS variables + 原生 CSS
- Web Worker：客户端仿真计算调度

### 共享包

- `@fengshui/core`
  - 户型数据结构
  - 几何工具
  - 模板生成
  - 校验逻辑
  - 罗盘/九宫/风水参考分析

- `@fengshui/simulation`
  - 栅格化
  - 热扩散求解
  - 气流压力场求解
  - 房间级热/风摘要
  - 前端可视化所需场数据

### 后端

- FastAPI
- Pydantic
- Pytest
- 当前为服务 stub，预留 AI 分析、报告生成、更高精度 CFD 接入。

### 工程化

- npm workspaces
- Turborepo
- TypeScript project references

## 目录结构

```text
3D-HOUSE-FS/
  apps/
    web/                         Next.js 3D 工作台
      src/app/                   App Router 页面、API 路由和全局样式
      src/components/
        AppShell.tsx             顶栏 / 工具栏 / 检查器 / 底部区总装
        Scene/                   3D 视口与 Three.js 场景
        Editor/                  属性编辑器
        Analysis/                分析面板与分析控制面板
        Templates/               模板与布局持久化
      src/simulation/            Web Worker 和仿真 hook
      src/lib/                   编辑器与 AI 配置工具

  packages/
    core/                        共享类型、几何、模板、风水逻辑
      src/types/
      src/geometry/
      src/fengshui/

    simulation/                  客户端热场/气流求解器
      src/grid/
      src/heat/
      src/airflow/
      src/summarize.ts

  backend/                       FastAPI stub
    main.py
    cfd/
    fengshui/
    ai/
    tests/

  docs/                          产品计划和设计文档
```

## 仿真架构

编辑户型后，前端会将 `HouseLayout` 传给 Web Worker：

```text
HouseLayout
  -> rasterizeLayout()
  -> solveFlow()
  -> solveHeat({ airflow })
  -> summarizeHeatField()
  -> summarizeFlowField()
  -> 3D layers + analysis panels
```

### 热场数据

`HeatField` 包含：

- 栅格信息
- 主温度场
- 多高度温度层
- 热/冷羽流
- 最小/最大温度

### 气流数据

`FlowField` 包含：

- 压力场
- 速度场 `vx/vy`
- 垂直速度
- 涡量
- 散度
- 入口点
- 全空间种子点
- 静态流线
- 峰值速度

## 运行方式

### 安装依赖

```powershell
npm install
```

### 启动前端

```powershell
cd apps/web
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

打开：

```text
http://127.0.0.1:3000
```

也可以在仓库根目录运行：

```powershell
npm.cmd run dev
```

### AI 建模配置（可选）

AI 草案入口会调用 `apps/web/src/app/api/ai/layout-from-text/route.ts`。配置方式是参考 `apps/web/.env.example`，在 `apps/web/.env.local` 写入实际变量：

```env
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_CHAT_COMPLETIONS_PATH=/chat/completions
AI_TIMEOUT_MS=20000
AI_MODEL=gpt-4o-mini
AI_API_KEY=你的服务密钥
```

也兼容 `OPENAI_API_KEY`。如果没有配置 `AI_API_KEY` / `OPENAI_API_KEY` 或 `AI_MODEL`，前端会显示“未配置 AI 服务”，并使用本地规则选择模板生成草案。`AI_BASE_URL` 和 `AI_CHAT_COMPLETIONS_PATH` 可指向其他 OpenAI 兼容网关。

### 启动后端

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

## 验证命令

### 类型检查

```powershell
npm.cmd run typecheck
```

### 生产构建

```powershell
npm.cmd run build
```

### 后端测试

```powershell
python -m pytest backend/tests
```

## 当前能力边界

- 当前热场/气流是 physics-lite 仿真，不是真正瞬态 Navier-Stokes CFD。
- 计算目标是浏览器内实时反馈，而不是工程审图级精度。
- 气流模型适合表达入口/出口、门窗连通、设备送风、低速死角和大致路径。
- 热场模型适合表达墙体阻隔、热源/冷源、传感约束、温度分层和气流换热影响。
- 风水模块只提供方位、宫位、年星和空间关系参考，不提供绝对吉凶结论。

## 后续可升级方向

- 更完整的有限体积热-风耦合。
- 可切换求解精度和网格分辨率。
- 房间级换气率、PMV/PPD 或热舒适指标。
- 更完整的报告导出。
- 后端 CFD/AI 分析服务。
- 多楼层、多开间、多屋顶形态。
- 罗盘专业层级继续扩展为更多圈层和可解释文本。
