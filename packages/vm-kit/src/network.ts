export interface GmRequestOptions {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string | FormData | Blob | ArrayBuffer;
  timeout?: number;
  responseType?: 'text' | 'json' | 'blob' | 'arraybuffer';
}

export interface GmRequestResult<T = unknown> {
  status: number;
  response: T;
  responseText: string;
  finalUrl: string;
}

export function gmRequest<T = unknown>(options: GmRequestOptions): Promise<GmRequestResult<T>> {
  const request = globalThis.GM_xmlhttpRequest;

  if (typeof request !== 'function') {
    return Promise.reject(new Error('GM_xmlhttpRequest is not available'));
  }

  return new Promise((resolve, reject) => {
    const details: Parameters<typeof request>[0] = {
      method: options.method ?? 'GET',
      url: options.url,
      onload: (response) => {
        resolve({
          status: response.status,
          response: response.response as T,
          responseText: response.responseText ?? '',
          finalUrl: response.finalUrl ?? options.url
        });
      },
      onerror: (error) => reject(error),
      ontimeout: () => reject(new Error(`GM_xmlhttpRequest timed out: ${options.url}`))
    };

    if (options.headers) {
      details.headers = options.headers;
    }

    if (options.data) {
      details.data = options.data;
    }

    if (options.timeout !== undefined) {
      details.timeout = options.timeout;
    }

    if (options.responseType !== undefined) {
      details.responseType = options.responseType;
    }

    request(details);
  });
}
