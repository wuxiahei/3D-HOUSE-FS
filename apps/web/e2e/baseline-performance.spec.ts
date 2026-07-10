import { promises as fs } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type TemplateId = "blank" | "compact-two-room" | "family-three-room";

interface LongTaskEntry {
  startTime: number;
  duration: number;
}

interface BaselineWindow extends Window {
  __baselineLongTasks: LongTaskEntry[];
  __baselineLongTaskObserver?: PerformanceObserver;
}

interface SampleMetrics {
  requestToReadyMs: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
}

interface TemplateBaseline {
  templateId: TemplateId;
  requestToReady: {
    medianMs: number;
    samplesMs: number[];
  };
  longTasks: {
    totalMedianMs: number;
    totalSamplesMs: number[];
    maxMedianMs: number;
    maxSamplesMs: number[];
  };
}

interface ProjectBaseline {
  projectName: string;
  viewport: {
    width: number;
    height: number;
  };
  templates: TemplateBaseline[];
}

interface BaselineOutput {
  generatedAt: string;
  results: ProjectBaseline[];
}

const templateIds: TemplateId[] = ["blank", "compact-two-room", "family-three-room"];
const sampleCount = 5;
const outputPath = path.resolve("test-results/performance-baseline.json");

function round(value: number) {
  return Number(value.toFixed(3));
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

async function measureTemplate(page: Page, templateId: TemplateId): Promise<SampleMetrics> {
  const status = page.getByTestId("simulation-status");
  const templateControls = page.getByTestId("template-controls");

  await expect(status).toHaveAttribute("data-state", /^(ready|invalid)$/);
  const measurementStart = await page.evaluate(() => {
    performance.clearMarks("simulation-request-start");
    performance.clearMarks("simulation-request-end");
    return performance.now();
  });

  await templateControls.getByTestId(`template-option-${templateId}`).click();
  await expect(status).toHaveAttribute("data-state", "computing");
  await expect(status).toHaveAttribute("data-state", /^(ready|invalid)$/);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  );

  return page.evaluate((startTime) => {
    const startMark = performance.getEntriesByName("simulation-request-start").at(-1);
    const endMark = performance.getEntriesByName("simulation-request-end").at(-1);
    if (!startMark || !endMark) {
      throw new Error("Simulation performance marks were not recorded");
    }

    const baselineWindow = window as unknown as BaselineWindow;
    const longTaskDurations = baselineWindow.__baselineLongTasks
      .filter((entry) => entry.startTime >= startTime)
      .map((entry) => entry.duration);

    return {
      requestToReadyMs: Number((endMark.startTime - startMark.startTime).toFixed(3)),
      longTaskTotalMs: Number(longTaskDurations.reduce((total, duration) => total + duration, 0).toFixed(3)),
      longTaskMaxMs: Number(Math.max(0, ...longTaskDurations).toFixed(3))
    };
  }, measurementStart);
}

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

test("records the production simulation baseline", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const baselineWindow = window as unknown as BaselineWindow;
    baselineWindow.__baselineLongTasks = [];

    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      baselineWindow.__baselineLongTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          baselineWindow.__baselineLongTasks.push({
            startTime: entry.startTime,
            duration: entry.duration
          });
        }
      });
      baselineWindow.__baselineLongTaskObserver.observe({ type: "longtask", buffered: true });
    }
  });

  await page.goto("/");
  const templates: TemplateBaseline[] = [];

  for (const templateId of templateIds) {
    await measureTemplate(page, templateId);
    const samples: SampleMetrics[] = [];

    for (let sample = 0; sample < sampleCount; sample += 1) {
      samples.push(await measureTemplate(page, templateId));
    }

    const requestSamples = samples.map((sample) => sample.requestToReadyMs).sort((left, right) => left - right);
    const totalLongTaskSamples = samples.map((sample) => sample.longTaskTotalMs).sort((left, right) => left - right);
    const maxLongTaskSamples = samples.map((sample) => sample.longTaskMaxMs).sort((left, right) => left - right);

    templates.push({
      templateId,
      requestToReady: {
        medianMs: median(requestSamples),
        samplesMs: requestSamples.map(round)
      },
      longTasks: {
        totalMedianMs: median(totalLongTaskSamples),
        totalSamplesMs: totalLongTaskSamples.map(round),
        maxMedianMs: median(maxLongTaskSamples),
        maxSamplesMs: maxLongTaskSamples.map(round)
      }
    });
  }

  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error("The baseline project must define a viewport");
  }

  const projectBaseline: ProjectBaseline = {
    projectName: testInfo.project.name,
    viewport,
    templates
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  let output: BaselineOutput = { generatedAt: new Date().toISOString(), results: [] };
  try {
    output = JSON.parse(await fs.readFile(outputPath, "utf8")) as BaselineOutput;
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode !== "ENOENT") {
      throw error;
    }
  }

  output.generatedAt = new Date().toISOString();
  output.results = output.results.filter((result) => result.projectName !== projectBaseline.projectName);
  output.results.push(projectBaseline);
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
});
