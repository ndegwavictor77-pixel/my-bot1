
import crypto from "node:crypto";
import { prisma } from "../config/db.js";

// Your actual BotStatus enum.
const BOT_STATUSES = [
    "STOPPED",
    "STARTING",
    "RUNNING",
    "PAUSED",
    "ERROR",
];

const ALLOWED_TIMEFRAMES = [
    "M1",
    "M5",
    "M15",
    "M30",
    "H1",
    "H4",
    "D1",
];

// Validate positive integer IDs.
const parseId = (value) => {
    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
};

// Format responses without exposing the secret instanceKey.
const formatBotInstance = (bot) => ({
    id: bot.id,
    userId: bot.userId,
    tradingAccountId: bot.tradingAccountId,
    configurationId: bot.configurationId,
    name: bot.name,
    status: bot.status,
    terminalVersion: bot.terminalVersion,
    eaVersion: bot.eaVersion,
    symbol: bot.symbol,
    timeframe: bot.timeframe,
    ipAddress: bot.ipAddress,
    lastHeartbeatAt: bot.lastHeartbeatAt,
    connectedAt: bot.connectedAt,
    disconnectedAt: bot.disconnectedAt,
    lastError: bot.lastError,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
});

// Helper: find a bot owned by the authenticated user.
const findOwnedBot = async (id, userId) => {
    return prisma.botInstance.findFirst({
        where: {
            id,
            userId,
        },
    });
};

// CREATE BOT INSTANCE
export const createBotInstance = async (req, res) => {
    try {
        const {
            tradingAccountId,
            configurationId,
            name,
            symbol,
            timeframe,
        } = req.body;

        const accountId = parseId(tradingAccountId);
        const configId = parseId(configurationId);

        if (!accountId || !configId) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid tradingAccountId and configurationId are required.",
            });
        }

        if (
            name !== undefined &&
            name !== null &&
            typeof name !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Name must be a string or null.",
            });
        }

        if (
            symbol !== undefined &&
            (
                typeof symbol !== "string" ||
                !symbol.trim() ||
                symbol.trim().length > 30
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Symbol must be a non-empty string of at most 30 characters.",
            });
        }

        if (
            timeframe !== undefined &&
            (
                typeof timeframe !== "string" ||
                !ALLOWED_TIMEFRAMES.includes(timeframe)
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid timeframe.",
            });
        }

        const userId = req.user.id;

        // Verify ownership of the trading account.
        const account = await prisma.tradingAccount.findFirst({
            where: {
                id: accountId,
                userId,
            },
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message:
                    "Trading account not found or does not belong to you.",
            });
        }

        // Verify ownership and account association of the configuration.
        const configuration = await prisma.botConfiguration.findFirst({
            where: {
                id: configId,
                userId,
                tradingAccountId: accountId,
            },
        });

        if (!configuration) {
            return res.status(404).json({
                success: false,
                message:
                    "Bot configuration not found for this trading account.",
            });
        }

        // Create a cryptographically random EA credential.
        const instanceKey = crypto.randomBytes(32).toString("hex");

        const bot = await prisma.botInstance.create({
            data: {
                userId,
                tradingAccountId: accountId,
                configurationId: configId,
                name:
                    typeof name === "string"
                        ? name.trim() || null
                        : null,
                symbol:
                    typeof symbol === "string"
                        ? symbol.trim()
                        : null,
                timeframe:
                    timeframe ?? configuration.entryTimeframe,
                status: "STOPPED",
                instanceKey,
            },
        });

        // Return the instance key once, at creation.
        // Never return it from list, detail, or update endpoints.
        return res.status(201).json({
            success: true,
            message: "Bot instance created successfully.",
            bot: formatBotInstance(bot),
            instanceKey,
            warning:
                "Store this key securely. It is an EA credential and must not be exposed publicly.",
        });
    } catch (error) {
        console.error("Create bot instance error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create bot instance.",
        });
    }
};

// GET ALL BOT INSTANCES
export const getBotInstances = async (req, res) => {
    try {
        const bots = await prisma.botInstance.findMany({
            where: {
                userId: req.user.id,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            count: bots.length,
            bots: bots.map(formatBotInstance),
        });
    } catch (error) {
        console.error("Get bot instances error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve bot instances.",
        });
    }
};

// GET ONE BOT INSTANCE
export const getBotInstanceById = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid bot instance ID.",
            });
        }

        const bot = await findOwnedBot(id, req.user.id);

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: "Bot instance not found.",
            });
        }

        return res.status(200).json({
            success: true,
            bot: formatBotInstance(bot),
        });
    } catch (error) {
        console.error("Get bot instance error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve bot instance.",
        });
    }
};

// UPDATE BOT DISPLAY SETTINGS
export const updateBotInstance = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid bot instance ID.",
            });
        }

        const bot = await findOwnedBot(id, req.user.id);

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: "Bot instance not found.",
            });
        }

        // These fields must not be supplied by ordinary user updates.
        const protectedFields = [
            "id",
            "userId",
            "tradingAccountId",
            "configurationId",
            "instanceKey",
            "status",
            "ipAddress",
            "terminalVersion",
            "eaVersion",
            "lastHeartbeatAt",
            "connectedAt",
            "disconnectedAt",
            "lastError",
        ];

        const forbiddenFields = protectedFields.filter(
            (field) => req.body[field] !== undefined
        );

        if (forbiddenFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Protected fields cannot be updated here.",
                fields: forbiddenFields,
            });
        }

        const data = {};

        if (req.body.name !== undefined) {
            if (
                req.body.name !== null &&
                typeof req.body.name !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Name must be a string or null.",
                });
            }

            data.name =
                typeof req.body.name === "string"
                    ? req.body.name.trim() || null
                    : null;
        }

        if (req.body.symbol !== undefined) {
            if (
                typeof req.body.symbol !== "string" ||
                !req.body.symbol.trim() ||
                req.body.symbol.trim().length > 30
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid symbol.",
                });
            }

            data.symbol = req.body.symbol.trim();
        }

        if (req.body.timeframe !== undefined) {
            if (
                typeof req.body.timeframe !== "string" ||
                !ALLOWED_TIMEFRAMES.includes(req.body.timeframe)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid timeframe.",
                });
            }

            data.timeframe = req.body.timeframe;
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide at least one editable field.",
            });
        }

        const updatedBot = await prisma.botInstance.update({
            where: {
                id,
            },
            data,
        });

        return res.status(200).json({
            success: true,
            message: "Bot instance updated successfully.",
            bot: formatBotInstance(updatedBot),
        });
    } catch (error) {
        console.error("Update bot instance error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update bot instance.",
        });
    }
};

// REQUEST BOT START
export const startBotInstance = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid bot instance ID.",
            });
        }

        const bot = await findOwnedBot(id, req.user.id);

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: "Bot instance not found.",
            });
        }

        const configuration = await prisma.botConfiguration.findFirst({
            where: {
                id: bot.configurationId,
                userId: req.user.id,
                tradingAccountId: bot.tradingAccountId,
            },
        });

        if (!configuration) {
            return res.status(400).json({
                success: false,
                message: "The bot configuration could not be found.",
            });
        }

        if (!configuration.enabled) {
            return res.status(400).json({
                success: false,
                message: "Enable the bot configuration before starting.",
            });
        }

        if (!configuration.autoTrading) {
            return res.status(400).json({
                success: false,
                message: "Auto-trading is disabled in this configuration.",
            });
        }

        if (bot.status === "RUNNING" || bot.status === "STARTING") {
            return res.status(409).json({
                success: false,
                message: "The bot is already running or starting.",
            });
        }

        const updatedBot = await prisma.botInstance.update({
            where: {
                id,
            },
            data: {
                status: "STARTING",
                lastError: null,
            },
        });

        return res.status(200).json({
            success: true,
            message:
                "Startup requested. The MT5 EA must acknowledge the request before the bot is considered running.",
            bot: formatBotInstance(updatedBot),
        });
    } catch (error) {
        console.error("Start bot instance error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to request bot startup.",
        });
    }
};

// REQUEST BOT STOP
export const stopBotInstance = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid bot instance ID.",
            });
        }

        const bot = await findOwnedBot(id, req.user.id);

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: "Bot instance not found.",
            });
        }

        if (bot.status === "STOPPED") {
            return res.status(200).json({
                success: true,
                message: "The bot is already stopped.",
                bot: formatBotInstance(bot),
            });
        }

        const updatedBot = await prisma.botInstance.update({
            where: {
                id,
            },
            data: {
                status: "STOPPED",
            },
        });

        return res.status(200).json({
            success: true,
            message:
                "The database status is now STOPPED. The MT5 EA must separately receive and acknowledge a stop command.",
            bot: formatBotInstance(updatedBot),
        });
    } catch (error) {
        console.error("Stop bot instance error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to stop bot instance.",
        });
    }
};

// PAUSE BOT
export const pauseBotInstance = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid bot instance ID.",
            });
        }

        const bot = await findOwnedBot(id, req.user.id);

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: "Bot instance not found.",
            });
        }

        if (bot.status !== "RUNNING") {
            return res.status(400).json({
                success: false,
                message: "Only a running bot can be paused.",
            });
        }

        const updatedBot = await prisma.botInstance.update({
            where: {
                id,
            },
            data: {
                status: "PAUSED",
            },
        });

        return res.status(200).json({
            success: true,
            message:
                "Pause recorded. The MT5 EA must acknowledge the pause and stop opening new trades.",
            bot: formatBotInstance(updatedBot),
        });
    } catch (error) {
        console.error("Pause bot instance error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to pause bot instance.",
        });
    }
};

// RESUME BOT
export const resumeBotInstance = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid bot instance ID.",
            });
        }

        const bot = await findOwnedBot(id, req.user.id);

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: "Bot instance not found.",
            });
        }

        if (bot.status !== "PAUSED") {
            return res.status(400).json({
                success: false,
                message: "Only a paused bot can be resumed.",
            });
        }

        const configuration = await prisma.botConfiguration.findFirst({
            where: {
                id: bot.configurationId,
                userId: req.user.id,
                tradingAccountId: bot.tradingAccountId,
            },
        });

        if (
            !configuration ||
            !configuration.enabled ||
            !configuration.autoTrading
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "The configuration must exist, be enabled, and have auto-trading enabled before resuming.",
            });
        }

        const updatedBot = await prisma.botInstance.update({
            where: {
                id,
            },
            data: {
                status: "STARTING",
                lastError: null,
            },
        });

        return res.status(200).json({
            success: true,
            message:
                "Resume requested. The MT5 EA must acknowledge the request before the bot is considered running.",
            bot: formatBotInstance(updatedBot),
        });
    } catch (error) {
        console.error("Resume bot instance error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to resume bot instance.",
        });
    }
};

// DELETE BOT INSTANCE
export const deleteBotInstance = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid bot instance ID.",
            });
        }

        const bot = await findOwnedBot(id, req.user.id);

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: "Bot instance not found.",
            });
        }

        if (
            bot.status === "RUNNING" ||
            bot.status === "STARTING"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Stop the bot and verify it is stopped before deleting the instance.",
            });
        }

        await prisma.botInstance.delete({
            where: {
                id,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Bot instance deleted successfully.",
        });
    } catch (error) {
        console.error("Delete bot instance error:", error);

        if (error.code === "P2003" || error.code === "P2014") {
            return res.status(409).json({
                success: false,
                message:
                    "This instance has related records and cannot be deleted. Keep it for auditing instead.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to delete bot instance.",
        });
    }
};

