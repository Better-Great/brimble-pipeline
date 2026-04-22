import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("../db/client.js", () => ({
  query: queryMock,
}));

describe("logStore", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("appends log with incremented line numbers", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ max_line: 3 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const { appendLog } = await import("./logStore.js");
    await appendLog("dep-a", "hello");

    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO logs"),
      ["dep-a", 4, "hello"],
    );
  });

  it("returns logs ordered by line", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 1, deployment_id: "dep-a", line_number: 1, content: "line", created_at: new Date() }],
    });

    const { getLogsForDeployment } = await import("./logStore.js");
    const rows = await getLogsForDeployment("dep-a");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.content).toBe("line");
  });
});
