import { EventEmitter } from "node:events";

export interface LogEventPayload {
  deploymentId: string;
  line: number;
  content: string;
}

export const logEmitter = new EventEmitter();
