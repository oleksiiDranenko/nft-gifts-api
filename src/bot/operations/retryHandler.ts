import { delay } from "../functions";

export const retryHandler: any = async (operation: any, retries = 3, backoff = 15000) => {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Operation failed: ${error.message}`);
    if (
      (error.name === "TimeoutError" ||
        error.message.includes("429") ||
        error.message.includes("502") ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("Protocol error")) &&
      retries > 0
    ) {
      const cappedBackoff = Math.min(backoff, 60000);
      await delay(cappedBackoff);
      return retryHandler(operation, retries - 1, cappedBackoff * 1.5);
    }
    throw error;
  }
};