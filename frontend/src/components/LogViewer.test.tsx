import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LogViewer } from "./LogViewer";

class MockEventSource {
  static instances: MockEventSource[] = [];
  public onmessage: ((event: MessageEvent<string>) => void) | null = null;
  public onerror: (() => void) | null = null;
  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }
  close(): void {}
}

describe("LogViewer", () => {
  it("opens stream, renders lines, and handles done", async () => {
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn() },
    });

    render(<LogViewer deploymentId="dep-7" isActive />);

    expect(MockEventSource.instances[0]?.url).toBe("/api/deployments/dep-7/logs");
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
    expect(screen.getByText("Waiting for deployment logs...")).toBeInTheDocument();

    MockEventSource.instances[0]?.onmessage?.({
      data: JSON.stringify({ line: 1, content: "Building...", deploymentId: "dep-7" }),
    } as MessageEvent<string>);

    await waitFor(() => {
      expect(screen.getByText(/1: Building/)).toBeInTheDocument();
    });

    MockEventSource.instances[0]?.onmessage?.({
      data: JSON.stringify({ done: true }),
    } as MessageEvent<string>);

    await waitFor(() => {
      expect(screen.getByText(/Stream ended/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Auto-scroll: on" }));
    expect(screen.getByRole("button", { name: "Auto-scroll: off" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });
  });
});
