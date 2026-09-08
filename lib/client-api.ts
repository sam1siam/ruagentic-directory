export async function api(path: string, data?: unknown, method = 'POST') {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (data !== undefined && method !== 'GET' && method !== 'HEAD')
    options.body = JSON.stringify(data);
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      result.error ?? 'This request could not finish.',
    ) as Error & { fields?: Record<string, string[]> };
    error.fields = result.fields;
    throw error;
  }
  return result;
}
