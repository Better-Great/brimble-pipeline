import { useState, type FormEvent } from "react";

import { useCreateDeployment } from "../api/queries";

export function DeployForm() {
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"git" | "upload">("git");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createDeployment = useCreateDeployment();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await createDeployment.mutateAsync({
        name,
        sourceType,
        sourceUrl: sourceType === "git" ? sourceUrl : undefined,
        file: sourceType === "upload" ? file : null,
      });
      setName("");
      setSourceType("git");
      setSourceUrl("");
      setFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deploy.";
      setErrorMessage(message);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      <input
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Deployment name"
        style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#141414", color: "#fff" }}
      />

      <div style={{ display: "flex", gap: 12 }}>
        <label>
          <input
            type="radio"
            checked={sourceType === "git"}
            onChange={() => setSourceType("git")}
          />{" "}
          Git URL
        </label>
        <label>
          <input
            type="radio"
            checked={sourceType === "upload"}
            onChange={() => setSourceType("upload")}
          />{" "}
          Upload ZIP
        </label>
      </div>

      {sourceType === "git" ? (
        <input
          required
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://github.com/user/repo"
          style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#141414", color: "#fff" }}
        />
      ) : (
        <input
          required
          type="file"
          accept=".zip"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
      )}

      <button
        type="submit"
        disabled={createDeployment.isPending}
        style={{ padding: "10px 16px", borderRadius: 8, background: "#4c7dff", color: "#fff", border: "none" }}
      >
        {createDeployment.isPending ? "Deploying..." : "Deploy"}
      </button>

      {errorMessage ? <p style={{ color: "#ff6666", margin: 0 }}>{errorMessage}</p> : null}
    </form>
  );
}
