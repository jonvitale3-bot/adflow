import "server-only";

/**
 * A Graph API error. The old build parsed these ad hoc in five places and
 * special-cased rate limits by regex-matching error strings.
 */
export class MetaApiError extends Error {
  readonly code: number | undefined;
  readonly subcode: number | undefined;
  readonly type: string | undefined;
  readonly traceId: string | undefined;
  readonly status: number;

  constructor(
    message: string,
    opts: {
      status: number;
      code?: number;
      subcode?: number;
      type?: string;
      traceId?: string;
    },
  ) {
    super(message);
    this.name = "MetaApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.subcode = opts.subcode;
    this.type = opts.type;
    this.traceId = opts.traceId;
  }

  /**
   * Meta returns 613 "user request limit reached" under sustained polling —
   * routinely, on the ad-set listing (docs/SPEC.md §6). Callers should back
   * off rather than fail the whole batch.
   */
  get isRateLimit(): boolean {
    return this.code === 4 || this.code === 17 || this.code === 613 || this.code === 32;
  }

  /** Token expired, revoked, or missing a permission. Retrying will not help. */
  get isAuthError(): boolean {
    return this.code === 190 || this.code === 102 || this.status === 401;
  }

  get isRetryable(): boolean {
    return this.isRateLimit || this.status >= 500;
  }
}

interface GraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_user_msg?: string;
  };
}

export function toMetaError(status: number, body: unknown): MetaApiError {
  const err = (body as GraphErrorBody)?.error;
  // error_user_msg is the human-readable form Meta shows in Ads Manager and is
  // far more useful than the developer message when it exists.
  const message =
    err?.error_user_msg ?? err?.message ?? `Meta API request failed (${status})`;

  return new MetaApiError(message, {
    status,
    code: err?.code,
    subcode: err?.error_subcode,
    type: err?.type,
    traceId: err?.fbtrace_id,
  });
}
