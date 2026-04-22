import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div>outlet</div>,
}));

describe("App", () => {
  it("renders route outlet", () => {
    render(<App />);
    expect(screen.getByText("outlet")).toBeInTheDocument();
  });
});
