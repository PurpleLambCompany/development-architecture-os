/** The private Method Library bucket. Mirrors 20261005000200_method_library_core.sql. */
export const METHOD_LIBRARY_BUCKET = "method-library";

export const METHOD_FILE_MAX_BYTES = 25 * 1024 * 1024;

export const METHOD_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;
