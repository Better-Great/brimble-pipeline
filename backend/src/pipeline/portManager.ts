import net from "node:net";

const usedPorts = new Set<number>();

function canBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
  });
}

export async function getAvailablePort(): Promise<number> {
  for (let port = 4000; port <= 5000; port += 1) {
    if (usedPorts.has(port)) {
      continue;
    }
    if (await canBind(port)) {
      usedPorts.add(port);
      return port;
    }
  }
  throw new Error("No available port found in range 4000-5000.");
}

export function releasePort(port: number): void {
  usedPorts.delete(port);
}
