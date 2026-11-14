import type {
  CalcItemInput,
  CalcResult,
  Coefficient,
  CoefficientQuery,
  CoefficientOptions,
  CoefficientOptionsQuery,
  Page,
  ProjectDetail,
  ProjectQuery,
  ProjectSummary,
  SaveRequest,
} from "./types";

export const serviceAddress =
  import.meta.env.VITE_API_BASE_URL ||
  "https://licensing-affect-sitemap-astrology.trycloudflare.com";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // 请求沿用构建时的站点前缀，支持 /ecp/ 等子路径下的同源代理。
  const timeout = AbortSignal.timeout(25000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}api${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      `无法连接后端服务，请检查服务地址或网络（${serviceAddress}）`,
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.code !== 0) {
    let message =
      body?.message || (typeof body?.detail === "string" ? body.detail : null);
    if (Array.isArray(body?.detail)) {
      message = body.detail
        .map(
          (entry: { loc?: string[]; msg?: string }) =>
            `${entry.loc?.join(".") || "参数"} ${entry.msg || "无效"}`,
        )
        .join("；");
    }
    throw new ApiError(
      message ||
        `请求失败（HTTP ${response.status}），请检查后端服务和 /api 代理配置`,
      response.status,
    );
  }
  return body.data as T;
}

function queryString(query: object): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  });
  return params.toString();
}

export const api = {
  // 建议新增的基础库选项接口，详细约定见《tool模块缺失接口清单.md》。
  coefficientOptions: (query: CoefficientOptionsQuery, signal?: AbortSignal) =>
    request<CoefficientOptions>(
      `/tool/pollutant_coefficient/options?${queryString(query)}`,
      { signal },
    ),
  coefficients: (query: CoefficientQuery, signal?: AbortSignal) =>
    request<Page<Coefficient>>(
      `/tool/pollutant_coefficient/page?${queryString(query)}`,
      { signal },
    ),
  preview: (items: CalcItemInput[]) =>
    request<CalcResult>("/tool/coefficient-calc/preview", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  save: (body: SaveRequest) =>
    request<ProjectDetail>("/tool/coefficient-calc", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  projects: (query: ProjectQuery, signal?: AbortSignal) =>
    request<Page<ProjectSummary>>(
      `/tool/coefficient-calc/page?${queryString(query)}`,
      { signal },
    ),
  detail: (id: string, signal?: AbortSignal) =>
    request<ProjectDetail>(`/tool/coefficient-calc/${encodeURIComponent(id)}`, {
      signal,
    }),
  remove: (id: string) =>
    request<null>(`/tool/coefficient-calc/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败，请稍后重试";
}
