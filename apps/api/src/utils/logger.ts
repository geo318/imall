import { env } from "@repo/shared";

export const logger = {
  debug: (...args: unknown[]) => {
    if (env.NODE_ENV === "development") {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
