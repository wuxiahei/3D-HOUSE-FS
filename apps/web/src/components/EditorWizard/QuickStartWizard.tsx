import type { HouseLayout } from "@fengshui/core";

const steps = [
  "1. 先选模板，快速得到可分析的基础户型",
  "2. 在顶视图里直接鼠标画墙，补充自定义隔断",
  "3. 调整房间尺寸、朝向、风向和温度点",
  "4. 在真实 3D 场景里查看房间、墙体和 3D 罗盘",
  "5. 对照热力图、气流图和九宫飞星信息综合分析"
];

export function QuickStartWizard({
  layout,
  validationCount
}: {
  layout: HouseLayout;
  validationCount: number;
}) {
  return (
    <div className="subpanel">
      <div className="subpanel-header">
        <h2>快速起步</h2>
        <span className="badge">{layout.templateId}</span>
      </div>
      <p className="muted">
        当前项目是 <strong>{layout.metadata.projectName}</strong>。这一版已经支持真实 3D
        场景、鼠标画墙和正式的风水信息联动，你可以按这个顺序快速体验完整流程。
      </p>
      <ol className="step-list">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="info-card accent-soft">
        <strong>当前提醒</strong>
        <p>
          {validationCount === 0
            ? "基础信息完整，可以继续做热力、气流和风水联动分析。"
            : `当前有 ${validationCount} 条提醒，建议先补齐基础信息。`}
        </p>
      </div>
    </div>
  );
}
