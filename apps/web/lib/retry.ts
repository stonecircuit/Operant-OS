/**
 * Wraps a promise-returning function with retry logic and exponential backoff.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 500,
  backoff = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    console.warn(`Operation failed, retrying in ${delay}ms... (${retries} attempts left)`, error);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * backoff, backoff);
  }
}
