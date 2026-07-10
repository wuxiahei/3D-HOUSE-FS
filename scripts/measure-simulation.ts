import { createTemplateLayout } from "@fengshui/core";
import type { TemplateId } from "@fengshui/core";
import { generateSimulation } from "@fengshui/simulation";

const templateIds: TemplateId[] = ["blank", "compact-two-room", "family-three-room"];
const sampleCount = 5;

const measurements = templateIds.map((templateId) => {
  const layout = createTemplateLayout(templateId);
  generateSimulation(layout);

  const samplesMs = Array.from({ length: sampleCount }, () => {
    const start = performance.now();
    generateSimulation(layout);
    return Number((performance.now() - start).toFixed(3));
  }).sort((left, right) => left - right);

  return {
    templateId,
    medianMs: samplesMs[Math.floor(samplesMs.length / 2)],
    samplesMs
  };
});

process.stdout.write(`${JSON.stringify(measurements, null, 2)}\n`);
