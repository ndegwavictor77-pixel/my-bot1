
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
    log:
        process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
});

export const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log("Database connected successfully via Prisma");
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
};

export const disconnectDB = async () => {
    try {
        await prisma.$disconnect();
        console.log("Database disconnected successfully");
    } catch (error) {
        console.error("Database disconnection failed:", error.message);
    }
};
