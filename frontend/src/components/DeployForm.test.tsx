import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeployForm } from "./DeployForm";

const mutateAsync = vi.fn();

vi.mock("../api/queries", () => ({
  useCreateDeployment: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

describe("DeployForm", () => {
  it("submits git deployment payload", async () => {
    mutateAsync.mockResolvedValueOnce({});
    render(<DeployForm />);

    fireEvent.change(screen.getByPlaceholderText("Deployment name"), {
      target: { value: "my-app" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo"), {
      target: { value: "https://github.com/a/b" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deploy" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-app",
          sourceType: "git",
          sourceUrl: "https://github.com/a/b",
        }),
      );
    });
  });
});
