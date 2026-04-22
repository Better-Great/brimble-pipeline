import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeploymentCard } from "./DeploymentCard";

const { mutateAsync, deleteState } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  deleteState: { isPending: false },
}));

vi.mock("../api/queries", async () => {
  const actual = await vi.importActual("../api/queries");
  return {
    ...actual,
    useDeleteDeployment: () => ({
      mutateAsync,
      isPending: deleteState.isPending,
    }),
  };
});

vi.mock("./LogViewer", () => ({
  LogViewer: ({ isActive }: { isActive: boolean }) => (
    <div data-testid="log-viewer">{isActive ? "open" : "closed"}</div>
  ),
}));

describe("DeploymentCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders deployment details and deletes", async () => {
    deleteState.isPending = false;
    mutateAsync.mockResolvedValueOnce(undefined);
    render(
      <DeploymentCard
        deployment={{
          id: "dep1",
          name: "Demo",
          status: "running",
          source_type: "git",
          source_url: "https://github.com/x/y",
          image_tag: "img:tag",
          url: "http://localhost/dep1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }}
      />,
    );

    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(mutateAsync).toHaveBeenCalledWith("dep1");
  });

  it("shows delete errors when deletion fails", async () => {
    deleteState.isPending = false;
    mutateAsync.mockRejectedValueOnce(new Error("nope"));
    render(
      <DeploymentCard
        deployment={{
          id: "dep1",
          name: "Demo",
          status: "running",
          source_type: "git",
          source_url: "https://github.com/x/y",
          image_tag: "img:tag",
          url: "http://localhost/dep1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("nope")).toBeInTheDocument();
  });
});
