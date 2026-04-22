import { beforeEach, describe, expect, it, vi } from "vitest";

const getAvailablePortMock = vi.fn();
const releasePortMock = vi.fn();
const execFileMock = vi.fn();

vi.mock("./portManager.js", () => ({
  getAvailablePort: getAvailablePortMock,
  releasePort: releasePortMock,
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

describe("runner", () => {
  beforeEach(() => {
    getAvailablePortMock.mockReset();
    releasePortMock.mockReset();
    execFileMock.mockReset();
  });

  it("delegates free-port lookup to port manager", async () => {
    getAvailablePortMock.mockResolvedValueOnce(4100);

    const { getFreePort } = await import("./runner.js");
    const port = await getFreePort();

    expect(port).toBe(4100);
  });

  it("returns notfound when inspect fails", async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], cb: (err: Error | null, stdout?: string, stderr?: string) => void) => {
        cb(new Error("nope"));
      },
    );

    const { getContainerStatus } = await import("./runner.js");
    const status = await getContainerStatus("missing");

    expect(status).toBe("notfound");
  });
});
