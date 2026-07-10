import { act, renderHook } from "@testing-library/react";
import { createTemplateLayout } from "@fengshui/core";
import { generateSimulation } from "@fengshui/simulation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useSimulation } from "./useSimulation";

const originalPerformanceMark = performance.mark;

describe("useSimulation performance marks", () => {
  const mark = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", undefined);
    mark.mockReset();
    Object.defineProperty(performance, "mark", {
      configurable: true,
      value: mark
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (originalPerformanceMark) {
      Object.defineProperty(performance, "mark", {
        configurable: true,
        value: originalPerformanceMark
      });
    } else {
      Reflect.deleteProperty(performance, "mark");
    }
  });

  test("marks synchronous initial and fallback calculations without layout details", async () => {
    const layout = createTemplateLayout("blank");

    renderHook(() => useSimulation(layout));

    expect(mark.mock.calls.slice(0, 2)).toEqual([
      ["simulation-request-start"],
      ["simulation-request-end"]
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(mark.mock.calls).toEqual([
      ["simulation-request-start"],
      ["simulation-request-end"],
      ["simulation-request-start"],
      ["simulation-request-end"]
    ]);
  });

  test("ends a worker request only when its matching response is ready", async () => {
    const result = generateSimulation(createTemplateLayout("compact-two-room"));
    const workers: FakeWorker[] = [];

    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();

      constructor() {
        workers.push(this);
      }
    }

    vi.stubGlobal("Worker", FakeWorker);
    renderHook(() => useSimulation(createTemplateLayout("compact-two-room")));
    mark.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    const activeWorker = workers.at(-1);
    if (!activeWorker) {
      throw new Error("Expected the hook to create a simulation worker");
    }
    expect(mark.mock.calls).toEqual([["simulation-request-start"]]);
    expect(activeWorker.postMessage).toHaveBeenCalledOnce();
    const request = activeWorker.postMessage.mock.calls[0]?.[0] as { id: number };

    act(() => {
      activeWorker.onmessage?.({ data: { id: request.id, result } } as MessageEvent);
    });

    expect(mark.mock.calls).toEqual([
      ["simulation-request-start"],
      ["simulation-request-end"]
    ]);
  });
});
