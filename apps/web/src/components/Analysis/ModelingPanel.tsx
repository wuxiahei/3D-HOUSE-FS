import type { HouseLayout, TemplateId } from "@fengshui/core";

const templateLabels: Record<TemplateId, string> = {
  blank: "空白",
  "compact-two-room": "紧凑两居",
  "family-three-room": "家庭三居"
};

type AiDraftStatusTone = "idle" | "loading" | "success" | "warning" | "error";

interface AiDraftStatus {
  tone: AiDraftStatusTone;
  text: string;
}

export function ModelingPanel({
  layout,
  aiPrompt,
  aiDraftPending,
  aiDraftStatus,
  onAiPromptChange,
  onGenerateAiDraft,
  onSelectTemplate
}: {
  layout: HouseLayout;
  aiPrompt: string;
  aiDraftPending: boolean;
  aiDraftStatus: AiDraftStatus;
  onAiPromptChange: (value: string) => void;
  onGenerateAiDraft: () => void;
  onSelectTemplate: (templateId: TemplateId) => void;
}) {
  return (
    <section className="dock-panel modeling-dock">
      <div className="dock-title">
        <strong>建模工作台</strong>
        <span>AI 草案 / 模板 / 手动编辑</span>
      </div>
      <div className="modeling-grid">
        <div className="modeling-block">
          <span className="eyebrow">AI 建模</span>
          <textarea
            value={aiPrompt}
            onChange={(event) => onAiPromptChange(event.target.value)}
            placeholder="例：做一个 90 平三室两厅，南向客厅，厨房靠西，主卧带卫生间"
          />
          <button type="button" disabled={aiDraftPending} onClick={onGenerateAiDraft}>
            {aiDraftPending ? "生成中..." : "生成 AI 草案"}
          </button>
          <p className={`ai-draft-status tone-${aiDraftStatus.tone}`}>{aiDraftStatus.text}</p>
        </div>

        <div className="modeling-block">
          <span className="eyebrow">模板建模</span>
          <div className="template-chip-row">
            {(Object.keys(templateLabels) as TemplateId[]).map((templateId) => (
              <button
                key={templateId}
                type="button"
                className={layout.templateId === templateId ? "active" : ""}
                onClick={() => onSelectTemplate(templateId)}
              >
                {templateLabels[templateId]}
              </button>
            ))}
          </div>
          <p>选择模板后仍可继续画墙、改门窗、加设备和温度点。</p>
        </div>

        <div className="modeling-block">
          <span className="eyebrow">当前模型</span>
          <strong>{layout.metadata.projectName}</strong>
          <p>
            {layout.rooms.length} 个房间 / {layout.walls.length} 段墙 / {layout.openings.length} 个门窗 / {layout.devices.length} 个设备
          </p>
        </div>
      </div>
    </section>
  );
}
