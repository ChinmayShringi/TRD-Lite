/**
 * Structured-logging singleton used across the sync pipeline.
 *
 * Pino is fast and JSON by default. We deliberately do NOT enable
 * pino-pretty's transport thread inside Next.js, because Next bundles
 * the runtime in a way that breaks pino-pretty's worker_threads loader.
 * pino-pretty is only opted in for CLI scripts via `LOG_PRETTY=1`.
 */
import pino, { type Logger } from "pino";

const usePretty = process.env.LOG_PRETTY === "1";

const baseOptions = {
  level: process.env.LOG_LEVEL ?? "info",
};

const prettyOptions = usePretty
  ? {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
    }
  : {};

export const logger: Logger = pino({ ...baseOptions, ...prettyOptions });
