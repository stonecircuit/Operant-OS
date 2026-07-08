/**
 * Structured Logging and Telemetry Monitoring Hooks.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogPayload {
  message: string;
  level: LogLevel;
  timestamp: string;
  context?: string;
  details?: Record<string, unknown>;
}

const SENSITIVE_KEYS = [
  "token", "apikey", "secret", "password", "key", "authorization", "idtoken", "bearer", "credential"
];

/**
 * Recursively scans details objects to redact sensitive keys.
 */
function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    const lowerKey = k.toLowerCase();
    if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
      clean[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      clean[k] = sanitizeDetails(v as Record<string, unknown>);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Redacts Authorization header tokens from log messages.
 */
function sanitizeMessage(message: string): string {
  return message.replace(/Bearer\s+[a-zA-Z0-9\-_.]+/gi, "Bearer [REDACTED]");
}

function writeLog(level: LogLevel, message: string, context?: string, details?: Record<string, unknown>) {
  const sanitizedMsg = sanitizeMessage(message);
  const sanitizedDetails = sanitizeDetails(details);

  const payload: LogPayload = {
    message: sanitizedMsg,
    level,
    timestamp: new Date().toISOString(),
    context,
    details: sanitizedDetails,
  };

  const logStr = `[${payload.timestamp}] [${level.toUpperCase()}]${context ? ` [${context}]` : ""} ${sanitizedMsg}`;

  // Log to appropriate console transport
  switch (level) {
    case "error":
      console.error(logStr, sanitizedDetails ? JSON.stringify(sanitizedDetails) : "");
      break;
    case "warn":
      console.warn(logStr, sanitizedDetails ? JSON.stringify(sanitizedDetails) : "");
      break;
    case "debug":
      if (process.env.NODE_ENV !== "production") {
        console.debug(logStr, sanitizedDetails ? JSON.stringify(sanitizedDetails) : "");
      }
      break;
    case "info":
    default:
      console.log(logStr, sanitizedDetails ? JSON.stringify(sanitizedDetails) : "");
      break;
  }
}

export const logger = {
  info: (message: string, context?: string, details?: Record<string, unknown>) =>
    writeLog("info", message, context, details),
  warn: (message: string, context?: string, details?: Record<string, unknown>) =>
    writeLog("warn", message, context, details),
  error: (message: string, context?: string, details?: Record<string, unknown>) =>
    writeLog("error", message, context, details),
  debug: (message: string, context?: string, details?: Record<string, unknown>) =>
    writeLog("debug", message, context, details),
};
