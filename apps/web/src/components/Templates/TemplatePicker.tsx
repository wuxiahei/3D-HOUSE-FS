import type { TemplateId } from "@fengshui/core";

const templates: { id: TemplateId; title: string; description: string }[] = [
  { id: "compact-two-room", title: "紧凑两居", description: "适合快速体验画墙、3D 场景和热力分析。" },
  { id: "family-three-room", title: "家庭三居", description: "更适合观察九宫、飞星和多房间联动。" },
  { id: "blank", title: "空白起步", description: "保留最少房间，适合逐步补墙和自定义扩展。" }
];

export function TemplatePicker({
  currentTemplate,
  onSelect
}: {
  currentTemplate: TemplateId;
  onSelect: (templateId: TemplateId) => void;
}) {
  return (
    <div className="subpanel">
      <div className="subpanel-header">
        <h2>模板起步</h2>
        <span className="badge">新手友好</span>
      </div>
      <div className="template-grid">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`template-card ${currentTemplate === template.id ? "active" : ""}`}
            onClick={() => onSelect(template.id)}
          >
            <strong>{template.title}</strong>
            <p>{template.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
