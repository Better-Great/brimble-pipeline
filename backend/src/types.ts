export enum DeploymentStatus {
  Pending = "pending",
  Building = "building",
  Deploying = "deploying",
  Running = "running",
  Failed = "failed",
}

export interface Deployment {
  id: string;
  name: string;
  status: DeploymentStatus;
  source_type: "git" | "upload" | null;
  source_url: string | null;
  image_tag: string | null;
  container_id: string | null;
  container_port: number | null;
  url: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Log {
  id: number;
  deployment_id: string | null;
  line_number: number;
  content: string;
  created_at: Date;
}

export interface CreateDeploymentInput {
  name: string;
  source_type: "git" | "upload" | null;
  source_url: string | null;
}
