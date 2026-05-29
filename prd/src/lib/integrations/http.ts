export async function fetchWithRetry(url: string, init?: RequestInit, timeoutMs = 8000) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      return response;
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new Error("Заявката отне твърде много време.");
      }
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Неуспешно извличане на данни.");
}
