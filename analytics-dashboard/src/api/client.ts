type TokenGetter = (options?: { template?: string }) => Promise<string | null>;

export type ApiClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
};

const API_PREFIX = '/api';

function toApiPath(path: string): string {
  if (path.startsWith(API_PREFIX)) {
    return path;
  }

  return `${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Request failed with status ${response.status}`;
  }

  try {
    const parsed = JSON.parse(text) as { message?: string };
    return parsed.message ?? text;
  } catch {
    return text;
  }
}

export function createApiClient(getToken: TokenGetter): ApiClient {
  async function request<T>(
    path: string,
    init: RequestInit = {},
    body?: unknown,
  ): Promise<T> {
    const token = await getToken({
      template: import.meta.env.VITE_CLERK_JWT_AUDIENCE,
    });

    if (!token) {
      throw new Error('Missing Clerk token');
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);

    let payload = init.body;
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
      payload = JSON.stringify(body);
    }

    const response = await fetch(toApiPath(path), {
      ...init,
      headers,
      body: payload,
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  return {
    get<T>(path: string) {
      return request<T>(path, { method: 'GET' });
    },
    post<T>(path: string, body?: unknown) {
      return request<T>(path, { method: 'POST' }, body);
    },
  };
}
