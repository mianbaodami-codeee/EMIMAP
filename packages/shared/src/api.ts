/**
 * 统一 API 协议与健康检查契约定义
 * 所有服务端接口均使用此结构返回，保证前后端及桌面客户端拥有一致的错误处理体验。
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "FORBIDDEN_OPERATION"
  | "API_KEY_REQUIRED"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_AI_ERROR"
  | "UPSTREAM_TIMEOUT"
  | "INTERNAL_ERROR";

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  durationMs?: number;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface HealthReport {
  status: "healthy" | "degraded";
  service: string;
  version: string;
  phase: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    ok: boolean;
    driver: "postgres" | "pglite";
    latencyMs: number;
    builtinSiteCount: number;
  };
  cache: {
    ok: boolean;
    driver: "redis" | "memory-lru";
  };
  aiGateway: {
    openaiServerKeyConfigured: boolean;
    geminiServerKeyConfigured: boolean;
    byokSupported: boolean;
  };
}
