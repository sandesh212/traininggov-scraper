export const handleResponse = async (response: Response) => {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
};

export const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout: number = 5000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), timeout)
        )
    ]);
};

export const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function withRetries<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; baseDelayMs?: number; factor?: number }
): Promise<T> {
  const retries = opts?.retries ?? 3;
  const base = opts?.baseDelayMs ?? 600;
  const factor = opts?.factor ?? 2;

  let attempt = 0;
  let lastErr: any;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      const code = err?.code;

      console.error(`[Retry ${attempt}/${retries}] Error: ${err?.message || err}`);
      if (code) console.error(`  Code: ${code}`);
      if (status) console.error(`  HTTP Status: ${status}`);

      // Do not retry 4xx except 429
      if (status && status !== 429 && status >= 400 && status < 500) {
        console.error(`  Non-retryable status ${status}, giving up`);
        break;
      }

      if (attempt < retries) {
        const delay = base * Math.pow(factor, attempt) + Math.round(Math.random() * 250);
        console.error(`  Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }

      attempt++;
    }
  }

  throw lastErr;
}