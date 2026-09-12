import { ApiError } from './api-error';
import type { ApiEnvelope, ApiFailureEnvelope } from './api.types';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
  onUnauthorized?: () => void;
}

export interface ApiRequestOptions {
  signal?: AbortSignal | undefined;
  headers?: HeadersInit | undefined;
}

export class ApiClient {
  public constructor(private readonly options: ApiClientOptions) {}

  public get<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.request<T>(path, {
      method: 'GET',
      signal: options.signal ?? null,
      headers: new Headers(options.headers),
    });
  }

  public post<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<T> {
    return this.withJsonBody<T>('POST', path, body, options);
  }

  public put<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<T> {
    return this.withJsonBody<T>('PUT', path, body, options);
  }

  public putBinary<T>(
    path: string,
    body: Blob,
    contentType: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('content-type', contentType);
    return this.request<T>(path, {
      method: 'PUT',
      signal: options.signal ?? null,
      headers,
      body,
    });
  }

  public patch<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<T> {
    return this.withJsonBody<T>('PATCH', path, body, options);
  }

  public delete<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.request<T>(path, {
      method: 'DELETE',
      signal: options.signal ?? null,
      headers: new Headers(options.headers),
    });
  }

  private withJsonBody<T>(
    method: 'POST' | 'PUT' | 'PATCH',
    path: string,
    body: unknown,
    options: ApiRequestOptions,
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('content-type', 'application/json');

    return this.request<T>(path, {
      method,
      signal: options.signal ?? null,
      headers,
      body: JSON.stringify(body),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const token = await this.options.getAccessToken?.();
    const headers = new Headers(init.headers);

    if (token) headers.set('authorization', `Bearer ${token}`);

    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      credentials: 'omit',
      headers,
    });

    const payload = (await response.json()) as ApiEnvelope<T> | ApiFailureEnvelope;

    if (!response.ok || !payload.success) {
      if (response.status === 401) this.options.onUnauthorized?.();
      if (!payload.success) {
        throw new ApiError(
          response.status,
          payload.error.code,
          payload.error.message,
          payload.request_id,
        );
      }

      throw new ApiError(response.status, 'UNKNOWN_API_ERROR', 'Unexpected API failure.');
    }

    return payload.data;
  }
}
