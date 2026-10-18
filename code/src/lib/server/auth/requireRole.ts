import { UserException } from "$lib/server/exceptions/UserException";
import jwt from "$lib/server/jwt/jwt";

export function requireRole(request: Request, role: string): { id: string; role: string } {
	const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
	if (!token) {
		throw new UserException("Authentication required", 401);
	}

	jwt.verifyToken(token);
	const claims = jwt.decodeToken(token);
	if (!claims || typeof claims !== "object" || typeof claims.id !== "string") {
		throw new UserException("Invalid token", 401);
	}
	if (claims.role !== role) {
		throw new UserException("Insufficient permissions", 403);
	}

	return { id: claims.id, role: claims.role };
}