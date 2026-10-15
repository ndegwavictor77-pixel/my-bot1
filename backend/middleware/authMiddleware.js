

import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";

export const protect = async (req, res, next) => {
    try {
        // 1. Get token from cookie or Authorization header.
        let token = req.cookies?.jwt;

        if (!token && req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.slice(7).trim();
        }

        // 2. Ensure a token exists.
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Please log in to access this resource",
            });
        }

        // 3. Ensure JWT_SECRET is configured.
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is missing from environment variables.");

            return res.status(500).json({
                success: false,
                message: "Authentication configuration error.",
            });
        }

        // 4. Verify the JWT.
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // 5. Validate the user ID in the token.
        const userId = Number(decoded.id);

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token.",
            });
        }

        // 6. Find the user in the database.
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                emailVerified: true,
            },
        });

        // 7. Check whether the user exists and is active.
        if (!user || user.status !== "ACTIVE") {
            res.clearCookie("jwt", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/",
            });

            return res.status(401).json({
                success: false,
                message: "Invalid session or inactive account.",
            });
        }

        // 8. Attach the authenticated user to the request.
        req.user = user;

        // 9. Continue to the controller.
        return next();

    } catch (error) {
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError"
        ) {
            res.clearCookie("jwt", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/",
            });

            return res.status(401).json({
                success: false,
                message: "Your session is invalid or expired. Please log in again.",
            });
        }

        console.error("Authentication middleware error:", error);

        return res.status(500).json({
            success: false,
            message: "Authentication failed.",
        });
    }
};

