import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeploymentList } from "./DeploymentList";

const { useDeployments } = vi.hoisted(() => ({
  useDeployments: vi.fn(),
}));

vi.mock("../api/queries", () => ({
  useDeployments,
}));

vi.mock("./DeploymentCard", () => ({
  DeploymentCard: ({ deployment }: { deployment: { name: string } }) => (
    <div data-testid="deployment-card">{deployment.name}</div>
  ),
}));

describe("DeploymentList", () => {
  it("shows loading placeholders", () => {
    useDeployments.mockReturnValue({ isLoading: true, data: undefined });
    const { container } = render(<DeploymentList />);
    expect(container.querySelectorAll("div").length).toBeGreaterThanOrEqual(3);
  });

  it("shows empty state", () => {
    useDeployments.mockReturnValue({ isLoading: false, data: [] });
    render(<DeploymentList />);
    expect(screen.getByText("No deployments yet")).toBeInTheDocument();
  });

  it("renders deployment count and cards", () => {
    useDeployments.mockReturnValue({
      isLoading: false,
      data: [
        { id: "1", name: "A" },
        { id: "2", name: "B" },
      ],
    });
    render(<DeploymentList />);
    expect(screen.getByText("2 deployments")).toBeInTheDocument();
    expect(screen.getAllByTestId("deployment-card")).toHaveLength(2);
  });
});
