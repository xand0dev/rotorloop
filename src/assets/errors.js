export class HttpError extends Error {
  constructor(response, url = response.url) {
    const category = response.status >= 500 ? "server" : "client";
    super(
      `HTTP ${response.status} ${response.statusText || category} for ${url}`,
    );
    this.name = "HttpError";
    this.status = response.status;
    this.url = url;
    this.category = category;
    this.retryable = response.status >= 500;
  }
}

export class JsonParseError extends Error {
  constructor(url, cause) {
    super(`Malformed JSON from ${url}`, { cause });
    this.name = "JsonParseError";
    this.url = url;
    this.retryable = false;
  }
}

export function createAbortError(reason = "The operation was aborted") {
  if (reason instanceof Error) return reason;
  return new DOMException(String(reason), "AbortError");
}

export function isAbortError(error) {
  return error?.name === "AbortError";
}

export function isRetryableError(error) {
  if (isAbortError(error) || error instanceof JsonParseError) return false;
  if (error instanceof HttpError) return error.retryable;
  return error instanceof TypeError || error?.name === "TimeoutError";
}
