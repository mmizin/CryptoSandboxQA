import type { APIRequestContext } from '@playwright/test';


type RequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    data?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
    headers?: Record<string, string>;
};



export function getApiUrl(): string {
    const raw =
      process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

    if (!raw) {
        throw new Error('API_URL or NEXT_PUBLIC_API_URL is not set');
    }

    return raw.replace(/\/$/, '');
  }



export class BaseApi {
    constructor(
        protected readonly requestContext: APIRequestContext,
        private readonly apiUrl:string = getApiUrl(),
        private readonly token?: string
    ) { }

    protected buildUrl(path: string, params?: RequestOptions['params']): string {
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        const url = new URL(`${this.apiUrl}${cleanPath}`);

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    url.searchParams.append(key, String(value));
                }
            });
        }

        return url.toString();
    }

    private async request<T>(path: string, options: RequestOptions & { isMultipart?: boolean }): Promise<T> {
        const url = this.buildUrl(path, options.params);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
            ...options.headers 
        };

        if (options.isMultipart) {
            delete headers['Content-Type'];
        }

        const response = await this.requestContext.fetch(url, {
            method: options.method,
            data: options.data,
            headers: headers,
        });

        if (!response.ok()) {
            const body = await response.text()
            throw new Error(`HTTP ${response.status()} ${path}: ${body}`)
        }

        if (response.status() === 204) {
            return null as T
        }

        return response.json() as Promise<T>
    }

    protected async get<T>(path: string, options: RequestOptions): Promise<T> {
        const response = await this.request<T>(path, {...options, method: 'GET'})
        return response
    }

    protected async post<T>(path: string, options: RequestOptions): Promise<T> {
        const response = await this.request<T>(path, {...options, method: 'POST'})
        return response
    }

    protected async put<T>(path: string, options: RequestOptions): Promise<T> {
        const response = await this.request<T>(path, {...options, method: 'PUT'})
        return response
    }

    protected async patch<T>(path: string, options: RequestOptions): Promise<T> {
        const response = await this.request<T>(path, {...options, method: 'PATCH'})
        return response
    }

    protected async delete<T>(path: string, options: RequestOptions): Promise<T> {
        const response = await this.request<T>(path, {...options, method: 'DELETE'})
        return response
    }


}
