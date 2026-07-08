import type { TemplateId } from "@fengshui/core";

const templates: { id: TemplateId; title: string; description: string }[] = [
  { id: "compact-two-room", title: "紧凑两居", description: "适合快速体验画墙、热力和气流图层。" },
  { id: "family-three-room", title: "家庭三居", description: "更适合观察九宫、飞星和多房间联动。" },
  { id: "blank", title: "空白起步", description: "保留最少房间，适合逐步补墙和自定义。" }
];

export function TemplatePicker({
  currentTemplate,
  onSelect
}: {
  currentTemplate: TemplateId;
  onSelect: (templateId: TemplateId) => void;
}) {
  return (
    <section className="inspector-section">
      <div className="section-title compact">
        <h2>模板</h2>
        <span>快速起步</span>
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
    </section>
  );
}
