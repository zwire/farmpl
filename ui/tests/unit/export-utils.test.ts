import { describe, expect, it, vi } from "vitest";

import {
  exportResultCsv,
  exportResultJson,
  toResultCsv,
  toResultJson,
} from "@/lib/export/export-utils";
import type { OptimizationResultView } from "@/lib/types/planning";

const sampleResult: OptimizationResultView = {
  status: "ok",
  objectiveValue: 123.45,
  stats: {
    stageOrder: ["profit", "labor"],
    stages: [
      { name: "profit", value: 1, locked: false },
      { name: "labor", value: 0.5, locked: false },
    ],
  },
  summary: {
    expected_profit: 200,
    idle_hours: 3,
  },
  constraintHints: [],
  warnings: ["note"],
};

const mockSaveAs = vi.fn();

vi.mock("file-saver", () => ({
  saveAs: (...args: unknown[]) => mockSaveAs(...args),
}));

describe("export-utils serialization", () => {
  it("creates result json", () => {
    const json = toResultJson(sampleResult);
    expect(json).toContain('"status": "ok"');
  });

  it("creates csv with metrics", () => {
    const csv = toResultCsv(sampleResult);
    expect(csv).toContain("stage:profit");
    expect(csv).toContain("summary:expected_profit");
  });
});

describe("export-utils downloads", () => {
  beforeEach(() => {
    mockSaveAs.mockClear();
    vi.stubGlobal("Blob", class MockBlob {} as never);
    vi.stubGlobal("window", {
      navigator: {},
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("triggers JSON download when result exists", () => {
    exportResultJson(sampleResult, { filename: "test" });
    expect(mockSaveAs).toHaveBeenCalledTimes(1);
  });

  it("skips JSON download when result missing", () => {
    exportResultJson(null);
    expect(mockSaveAs).not.toHaveBeenCalled();
  });

  it("triggers CSV download when result exists", () => {
    exportResultCsv(sampleResult, { filename: "test" });
    expect(mockSaveAs).toHaveBeenCalledTimes(1);
  });
});
