import type { HouseLayout } from "@fengshui/core";
import type { RoomFlowSummary, RoomHeatSummary } from "@fengshui/simulation";

function roomArea(layout: HouseLayout) {
  return layout.rooms.reduce((total, room) => total + room.width * room.depth, 0);
}

function styleSuggestion(layout: HouseLayout) {
  const area = roomArea(layout);
  if (area < 55) {
    return "小户型建议以现代简约、浅色墙面和高收纳为主。";
  }
  if (layout.rooms.some((room) => room.purpose === "study")) {
    return "有独立学习或办公空间，适合原木、现代或轻日式风格。";
  }
  return "建议采用现代舒适风格，公共区保持开阔，卧室强调安静和遮光。";
}

function riskChecklist({
  hottest,
  quietestRoom
}: {
  hottest?: RoomHeatSummary;
  quietestRoom?: HouseLayout["rooms"][number];
}) {
  const items = [
    "水电阶段预留空调回风、排风和传感点位置，避免后期明线返工。",
    "大柜体不要压住主要门窗连通线，先保通风再做收纳最大化。"
  ];
  if (hottest) {
    items.push(`${hottest.roomName ?? hottest.roomId} 温度偏高，硬装阶段优先考虑遮阳、隔热和可维护的排风路径。`);
  }
  if (quietestRoom) {
    items.push(`${quietestRoom.name} 气流偏弱，避免封闭式高柜、厚重软隔断继续削弱通风。`);
  }
  return items;
}

export function RenovationReportPanel({
  layout,
  heatmap,
  airflow
}: {
  layout: HouseLayout;
  heatmap: RoomHeatSummary[];
  airflow: RoomFlowSummary[];
}) {
  const area = roomArea(layout);
  const budgetLow = Math.round(area * 1400);
  const budgetHigh = Math.round(area * 3200);
  const hottest = [...heatmap].sort((a, b) => b.temperature - a.temperature)[0];
  const quietest = [...airflow].sort((a, b) => a.averageSpeed - b.averageSpeed)[0];
  const quietestRoom = layout.rooms.find((room) => room.id === quietest?.roomId);
  const risks = riskChecklist({ hottest, quietestRoom });

  return (
    <section className="dock-panel renovation-dock">
      <div className="dock-title">
        <strong>装修建议与报告</strong>
        <span>基于模型和分析结果生成</span>
      </div>
      <div className="report-grid">
        <article className="report-card">
          <span className="eyebrow">风格建议</span>
          <p>{styleSuggestion(layout)}</p>
        </article>
        <article className="report-card">
          <span className="eyebrow">预算区间</span>
          <strong>
            {budgetLow.toLocaleString()} - {budgetHigh.toLocaleString()} 元
          </strong>
          <p>按当前房间面积估算，后续可拆分硬装、家具、家电三档预算。</p>
        </article>
        <article className="report-card">
          <span className="eyebrow">材料建议</span>
          <p>客餐厅建议耐磨地面，卧室重视隔音和遮光，厨卫优先防水、防滑、排风。</p>
        </article>
        <article className="report-card">
          <span className="eyebrow">施工顺序</span>
          <p>{"拆改 -> 水电 -> 防水 -> 泥木 -> 油漆 -> 安装 -> 软装 -> 验收"}</p>
        </article>
        <article className="report-card">
          <span className="eyebrow">分析转建议</span>
          <p>
            {hottest
              ? `${hottest.roomName ?? hottest.roomId} 温度偏高，装修时注意遮阳、排风和空调回风路径。`
              : "暂无热力异常。"}
            {quietestRoom ? ` ${quietestRoom.name} 气流较弱，建议避免大型柜体进一步阻挡通风。` : ""}
          </p>
        </article>
        <article className="report-card">
          <span className="eyebrow">避坑清单</span>
          <ul className="report-list">
            {risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="report-card">
          <span className="eyebrow">报告内容</span>
          <p>后续可导出户型图、3D 截图、热力图、气流图、家具方案、预算和施工清单。</p>
        </article>
      </div>
    </section>
  );
}
