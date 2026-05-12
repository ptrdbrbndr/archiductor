import { jwtVerify, type JWTPayload } from "jose";

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
    const isExpired =
      err instanceof Error && err.message.toLowerCase().includes("expired");
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
