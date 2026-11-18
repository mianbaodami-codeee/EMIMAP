import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiErrorCode, ApiFailure, ApiSuccess } from "@omnikit/shared";

/**
 * 统一构造服务端 JSON API 响应，附带 requestId、时间戳与处理耗时
 */

export function apiOk<T>(
  data: T,
  options?: { status?: number; startedAt?: number; headers?: HeadersInit }
): NextResponse<ApiSuccess<T>> {
  const durationMs = options?.startedAt
    ? Math.max(0, Date.now() - options.startedAt)
    : undefined;

  return NextResponse.json(
    {
      ok: true,
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        ...(durationMs !== undefined ? { durationMs } : {}),
      },
    },
    {
      status: options?.status ?? 200,
      headers: options?.headers,
    }
  );
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  options?: {
    status?: number;
    details?: unknown;
    startedAt?: number;
    headers?: HeadersInit;
  }
): NextResponse<ApiFailure> {
  const durationMs = options?.startedAt
    ? Math.max(0, Date.now() - options.startedAt)
    : undefined;

  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(options?.details !== undefined ? { details: options.details } : {}),
      },
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        ...(durationMs !== undefined ? { durationMs } : {}),
      },
    },
    {
      status: options?.status ?? 400,
      headers: options?.headers,
    }
  );
}

export function handleUnexpectedApiError(
  err: unknown,
  startedAt: number
): NextResponse<ApiFailure> {
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    return apiError(
      "VALIDATION_ERROR",
      firstIssue?.message || "请求参数校验未通过",
      {
        status: 400,
        details: err.flatten(),
        startedAt,
      }
    );
  }

  console.error("[API Error]", err);
  return apiError(
    "INTERNAL_ERROR",
    err instanceof Error ? err.message : "服务器内部处理异常",
    { status: 500, startedAt }
  );
}
