
import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is missing from environment variables");
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || "60m";

    const token = jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn }
    );

    res.cookie("jwt", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 1000, // 1 hour
        path: "/",
    });

    return token;
};

