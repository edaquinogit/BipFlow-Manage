/**
 * BipFlow Structured Logger
 *
 * Provides professional, structured logging for production environments.
 * Implements RFC 5424 syslog severity levels.
 *
 * Usage:
 *   Logger.error('Auth failed', { userId: 123, status: 401 })
 *   Logger.warn('Slow operation', { duration: 5000 })
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';
type LogContext = Record<string, unknown>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  source?: string;
}

class StructuredLogger {
  private isDevelopment = import.meta.env.DEV;

  /**
   * Log an error with context
   * @param message - Human-readable error message
   * @param context - Structured data about the error
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * Log a warning with context
   * @param message - Human-readable warning message
   * @param context - Structured data about the warning
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log info-level messages (development only in production)
   * @param message - Human-readable info message
   * @param context - Structured data about the event
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('info', message, context);
    }
  }

  /**
   * Log debug-level messages (development only)
   * @param message - Human-readable debug message
   * @param context - Structured data for debugging
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source: 'bipflow-frontend',
      ...(context && { context }),
    };

    // In production, structured logs would be sent to a logging service (DataDog, Splunk, etc.)
    // For now, we use appropriate console methods
    const logMethod = this.getConsoleMethod(level);
    logMethod(`[${entry.level.toUpperCase()}] ${entry.message}`, context || '');
  }

  private getConsoleMethod(level: LogLevel): typeof console.error {
    switch (level) {
      case 'error':
        return console.error;
      case 'warn':
        return console.warn;
      case 'info':
        return console.info;
      case 'debug':
        return console.debug;
      default:
        return console.log;
    }
  }
}

export const Logger = new StructuredLogger();
