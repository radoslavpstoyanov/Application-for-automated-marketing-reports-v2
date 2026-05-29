type ReportLogContext = Record<string, unknown>;

function isEnabled() {
  return process.env.NODE_ENV !== "production";
}

export const reportLogger = {
  debug(message: string, context?: ReportLogContext) {
    if (isEnabled()) {
      console.debug(`[report] ${message}`, context ?? {});
    }
  },
  warn(message: string, context?: ReportLogContext) {
    if (isEnabled()) {
      console.warn(`[report] ${message}`, context ?? {});
    }
  },
};
