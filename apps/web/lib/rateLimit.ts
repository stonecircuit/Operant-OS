// Simple in-memory rate limiter using sliding window
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Checks if a client IP address has exceeded request limits.
 */
export function isRateLimited(ip: string, limit = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const clientData = ipRequestCounts.get(ip);
  
  if (!clientData) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (now > clientData.resetTime) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  clientData.count += 1;
  if (clientData.count > limit) {
    return true;
  }
  
  return false;
}

/**
 * Resolves the client IP address from request headers.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  
  return "anonymous";
}
