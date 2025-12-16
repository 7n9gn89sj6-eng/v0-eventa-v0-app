/**
 * Structured logging utility
 * Provides consistent logging format across the application
 * Can be extended to use pino/winston in the future
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isProduction = process.env.NODE_ENV === "production";

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    };
    console.error(this.formatMessage("error", message, errorContext));
  }

  // Convenience method for API route logging
  api(route: string, method: string, statusCode: number, duration?: number, context?: LogContext): void {
    const apiContext: LogContext = {
      route,
      method,
      statusCode,
      ...(duration && { durationMs: duration }),
      ...context,
    };
    if (statusCode >= 500) {
      this.error(`API ${method} ${route}`, undefined, apiContext);
    } else if (statusCode >= 400) {
      this.warn(`API ${method} ${route}`, apiContext);
    } else {
      this.info(`API ${method} ${route}`, apiContext);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for use in other files
export type { LogContext };
