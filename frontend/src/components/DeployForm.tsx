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
    <section className="card deploy-form-card">
      <form onSubmit={onSubmit} className="deploy-form">
        <div className="field">
          <p className="label">Deployment name</p>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Deployment name"
            className="input"
          />
        </div>

        <div className="source-toggle">
          <label className="source-pill">
            <input
              type="radio"
              checked={sourceType === "git"}
              onChange={() => setSourceType("git")}
            />
            Git URL
          </label>
          <label className="source-pill">
            <input
              type="radio"
              checked={sourceType === "upload"}
              onChange={() => setSourceType("upload")}
            />
            Upload ZIP
          </label>
        </div>

        {sourceType === "git" ? (
          <div className="field">
            <p className="label">Repository URL</p>
            <input
              required
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://github.com/user/repo"
              className="input"
            />
          </div>
        ) : (
          <div className="field">
            <p className="label">Upload ZIP file</p>
            <input
              required
              type="file"
              accept=".zip"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="input"
            />
          </div>
        )}

        <div className="actions">
          <button
            type="submit"
            disabled={createDeployment.isPending}
            className="btn btn--primary"
          >
            {createDeployment.isPending ? "Deploying..." : "Deploy"}
          </button>
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </form>
    </section>
  );
}
