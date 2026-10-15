
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import {
    connectDB,
    disconnectDB,
} from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import tradingAccountRoutes from "./routes/tradingAccountRoutes.js";
import botConfigurationRoutes from "./routes/botConfigurationRoutes.js";
import botInstanceRoutes from "./routes/botInstanceRoutes.js";
import botEventRoutes from "./routes/botEventRoutes.js";
import tradeSignalRoutes from "./routes/tradeSignalRoutes.js";
import tradeOrderRoutes from "./routes/tradeOrderRoutes.js";    
import tradeRoutes from "./routes/tradeRoutes.js";

// Load environment variables
dotenv.config();

const app = express();
app.use(cookieParser());
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/trading-accounts", tradingAccountRoutes);
app.use("/api/bot-configurations", botConfigurationRoutes);
app.use("/api/bot-instances", botInstanceRoutes);
app.use("/api/bot-events", botEventRoutes);
app.use("/api/trade-signals", tradeSignalRoutes);
app.use("/api/trade-orders", tradeOrderRoutes);
app.use("/api/trades", tradeRoutes);
// Test route
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Forex Trading Bot API is running",
    });
});



// Start server only after connecting to the database
let server;

const startServer = async () => {
    try {
        await connectDB();

        server = app.listen(PORT, () => {
            console.log(`Server running on port: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        await disconnectDB();
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);

    if (server) {
        server.close(async () => {
            await disconnectDB();
            process.exit(0);
        });
    } else {
        await disconnectDB();
        process.exit(0);
    }
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);

    shutdown("unhandledRejection");
});

// Handle uncaught exceptions
process.once("uncaughtException", async (error) => {
    console.error("Uncaught exception:", error);

    await shutdown("uncaughtException");
});

startServer();
