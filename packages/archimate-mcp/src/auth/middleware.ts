import { jwtVerify, errors, type JWTPayload } from "jose";

const JWT_SECRET_ENV = "MCP_JWT_SECRET";

function getSecret(): Uint8Array {
  const secret = process.env[JWT_SECRET_ENV];
  if (!secret) {
    throw new Error(`Missing required environment variable: ${JWT_SECRET_ENV}`);
  }
  return new TextEncoder().encode(secret);
}

export interface AuthPayload {
  user_id: string;
  model_id: string;
}

export interface AuthError {
  code: "MISSING_TOKEN" | "INVALID_TOKEN" | "EXPIRED_TOKEN" | "MODEL_MISMATCH";
  message: string;
}

export type AuthResult =
  | { ok: true; payload: AuthPayload }
  | { ok: false; error: AuthError };

interface McpJwtPayload extends JWTPayload {
  user_id: string;
  model_id: string;
}

/**
 * Validates a Bearer JWT and checks that the model_id in the token
 * matches the model_id from the tool parameters.
 *
 * @param bearerToken - The raw Authorization header value ("Bearer <token>") or just the token
 * @param toolModelId - The model_id supplied by the Claude tool call
 */
export async function validateAuth(
  bearerToken: string | undefined,
  toolModelId: string,
): Promise<AuthResult> {
  if (!bearerToken) {
    return {
      ok: false,
      error: {
        code: "MISSING_TOKEN",
        message: "Authorization token is required",
      },
    };
  }

  const token = bearerToken.startsWith("Bearer ")
    ? bearerToken.slice(7)
    : bearerToken;

  let payload: McpJwtPayload;
  try {
    const result = await jwtVerify(token, getSecret(), {
      clockTolerance: 0,
    });
    payload = result.payload as McpJwtPayload;
  } catch (err) {
    const isExpired = err instanceof errors.JWTExpired;
    return {
      ok: false,
      error: {
        code: isExpired ? "EXPIRED_TOKEN" : "INVALID_TOKEN",
        message: isExpired
          ? "Token has expired — request a new token"
          : "Token validation failed",
      },
    };
  }

  if (!payload.user_id || !payload.model_id) {
    return {
      ok: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Token payload is missing required fields (user_id, model_id)",
      },
    };
  }

  if (payload.model_id !== toolModelId) {
    return {
      ok: false,
      error: {
        code: "MODEL_MISMATCH",
        message: `Token model_id (${payload.model_id}) does not match requested model_id (${toolModelId})`,
      },
    };
  }

  return {
    ok: true,
    payload: {
      user_id: payload.user_id,
      model_id: payload.model_id,
    },
  };
}

/**
 * Extracts the Authorization header from an HTTP request header map.
 */
export function extractBearerToken(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const authHeader = headers["authorization"];
  if (!authHeader) return undefined;
  return Array.isArray(authHeader) ? authHeader[0] : authHeader;
}

// ---------------------------------------------------------------------------
// verifyJwt — throwing variant used by tool handlers
// ---------------------------------------------------------------------------

export interface AuthContext {
  userId: string;
  modelId: string;
}

/**
 * Validates a Bearer JWT and checks that the model_id in the token matches
 * the tool parameter model_id.  Throws on any validation failure so callers
 * can use a simple try/catch instead of discriminated-union checks.
 *
 * @param authHeader - Raw "Authorization" header value (must start with "Bearer ")
 * @param toolModelId - The model_id supplied by the Claude tool call
 * @returns AuthContext { userId, modelId }
 * @throws Error with human-readable message on any failure
 */
export async function verifyJwt(
  authHeader: string | undefined,
  toolModelId: string,
): Promise<AuthContext> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);

  let payload: McpJwtPayload;
  try {
    const result = await jwtVerify(token, getSecret(), { clockTolerance: 0 });
    payload = result.payload as McpJwtPayload;
  } catch (err) {
    throw err instanceof Error ? err : new Error("Token validation failed");
  }

  if (!payload.user_id || !payload.model_id) {
    throw new Error("Invalid JWT payload: missing user_id or model_id");
  }

  if (payload.model_id !== toolModelId) {
    throw new Error(
      `model_id in JWT (${payload.model_id}) does not match tool parameter (${toolModelId})`,
    );
  }

  return { userId: payload.user_id, modelId: payload.model_id };
}
