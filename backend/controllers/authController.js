
import { prisma } from "../config/db.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";

// =====================================================
// HELPER: Remove sensitive fields from user responses
// =====================================================
const formatUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

// =====================================================
// 1. REGISTER USER
// POST /api/auth/register
// =====================================================
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and password are required",
            });
        }

        // Validate name
        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid name",
            });
        }

        // Validate email
        if (
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address",
            });
        }

        // Validate password
        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check whether email already exists
        const existingUser = await prisma.user.findUnique({
            where: {
                email: normalizedEmail,
            },
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        // Hash password before saving
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        // Role, status, and emailVerified use Prisma defaults.
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                password: hashedPassword,
            },
        });

        // Automatically log in the user after registration.
        // Remove this call if you require email verification before login.
        generateToken(user.id, res);

        return res.status(201).json({
            success: true,
            message: "Account registered successfully",
            user: formatUser(user),
        });
    } catch (error) {
        // Handle duplicate email race conditions
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        console.error("Registration error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred during registration",
        });
    }
};

// =====================================================
// 2. LOGIN USER
// POST /api/auth/login
// =====================================================
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Find user
        const user = await prisma.user.findUnique({
            where: {
                email: normalizedEmail,
            },
        });

        // Do not reveal whether the email exists
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Verify password
        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Ensure account is active
        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive or suspended",
            });
        }

        // Record successful login
        const updatedUser = await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                lastLoginAt: new Date(),
            },
        });

        // Issue JWT cookie
        generateToken(updatedUser.id, res);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            user: formatUser(updatedUser),
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred during login",
        });
    }
};

// =====================================================
// 3. LOGOUT USER
// POST /api/auth/logout
// =====================================================
export const logout = (req, res) => {
    res.clearCookie("jwt", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
    });

    return res.status(200).json({
        success: true,
        message: "Logged out successfully",
    });
};

// =====================================================
// 4. GET LOGGED-IN USER
// GET /api/auth/me
// Requires: protect middleware
// =====================================================
export const getMe = async (req, res) => {
    try {
        // req.user is set by the protect middleware
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            user: formatUser(user),
        });
    } catch (error) {
        console.error("Get profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not retrieve your profile",
        });
    }
};

// =====================================================
// 5. UPDATE USER PROFILE
// PATCH /api/auth/profile
// Requires: protect middleware
// =====================================================
export const updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;

        if (name === undefined && email === undefined) {
            return res.status(400).json({
                success: false,
                message: "Provide a name or email to update",
            });
        }

        const data = {};

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Name must be a non-empty string",
                });
            }

            data.name = name.trim();
        }

        if (email !== undefined) {
            if (
                typeof email !== "string" ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid email address",
                });
            }

            const normalizedEmail = email.trim().toLowerCase();

            if (normalizedEmail !== req.user.email) {
                const existingUser = await prisma.user.findUnique({
                    where: {
                        email: normalizedEmail,
                    },
                });

                if (existingUser) {
                    return res.status(409).json({
                        success: false,
                        message: "That email address is already in use",
                    });
                }

                data.email = normalizedEmail;

                // Require verification again after changing email.
                data.emailVerified = false;
            }
        }

        const updatedUser = await prisma.user.update({
            where: {
                id: req.user.id,
            },
            data,
        });

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: formatUser(updatedUser),
        });
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "That email address is already in use",
            });
        }

        console.error("Update profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not update your profile",
        });
    }
};

// =====================================================
// 6. CHANGE PASSWORD
// PATCH /api/auth/change-password
// Requires: protect middleware
// =====================================================
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (
            typeof currentPassword !== "string" ||
            typeof newPassword !== "string" ||
            !currentPassword ||
            !newPassword
        ) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required",
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters long",
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const passwordMatches = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!passwordMatches) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect",
            });
        }

        const samePassword = await bcrypt.compare(
            newPassword,
            user.password
        );

        if (samePassword) {
            return res.status(400).json({
                success: false,
                message: "New password must differ from current password",
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                password: hashedPassword,
            },
        });

        // Clear cookie so the user must log in again.
        // For immediate revocation of all sessions, use a server-side
        // session or token-version mechanism.
        res.clearCookie("jwt", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        });

        return res.status(200).json({
            success: true,
            message: "Password changed successfully. Please log in again.",
        });
    } catch (error) {
        console.error("Change password error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not change your password",
        });
    }
};

