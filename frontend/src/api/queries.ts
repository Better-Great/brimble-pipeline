import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

const API_BASE = "/api";
const REQUEST_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Check that backend API is reachable.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export type Deployment = {
  id: string;
  name: string;
  status: "pending" | "building" | "deploying" | "running" | "failed";
  source_type: "git" | "upload" | null;
  source_url: string | null;
  image_tag: string | null;
  container_id?: string | null;
  container_port?: number | null;
  url: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateDeploymentPayload = {
  name: string;
  sourceType: "git" | "upload";
  sourceUrl?: string;
  file?: File | null;
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
      },
    },
  });
}

export function useDeployments(): UseQueryResult<Deployment[]> {
  return useQuery({
    queryKey: ["deployments"],
    queryFn: async () => {
      const response = await fetchWithTimeout(`${API_BASE}/deployments`);
      if (!response.ok) {
        throw new Error("Failed to load deployments");
      }
      return (await response.json()) as Deployment[];
    },
    refetchInterval: 4_000,
  });
}

export function useDeployment(id: string): UseQueryResult<Deployment> {
  return useQuery({
    queryKey: ["deployments", id],
    queryFn: async () => {
      const response = await fetchWithTimeout(`${API_BASE}/deployments/${id}`);
      if (!response.ok) {
        throw new Error("Failed to load deployment");
      }
      return (await response.json()) as Deployment;
    },
    refetchInterval: 3_000,
    enabled: Boolean(id),
  });
}

export function useCreateDeployment(): UseMutationResult<Deployment, Error, CreateDeploymentPayload> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const isUpload = payload.sourceType === "upload";
      const response = await (async () => {
        if (isUpload) {
          const formData = new FormData();
          formData.append("name", payload.name);
          formData.append("sourceType", payload.sourceType);
          if (payload.sourceUrl) {
            formData.append("sourceUrl", payload.sourceUrl);
          }
          if (payload.file) {
            formData.append("file", payload.file, payload.file.name);
          }
          return fetchWithTimeout(`${API_BASE}/deployments`, {
            method: "POST",
            body: formData,
          });
        }
        return fetchWithTimeout(`${API_BASE}/deployments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      })();

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Failed to create deployment");
      }
      return (await response.json()) as Deployment;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
}

export function useDeleteDeployment(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/deployments/${id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        throw new Error("Failed to delete deployment");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
}
