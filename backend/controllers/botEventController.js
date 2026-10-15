
import { prisma } from "../config/db.js";

// Use the BotEventType values from your Prisma schema.
const ALLOWED_EVENT_TYPES = [
    "CONNECTED",
    "DISCONNECTED",
    "STARTED",
    "STOPPED",
    "PAUSED",
    "RESUMED",
    "ERROR",
    "HEARTBEAT",
    "CONFIG_UPDATED",
    "TRADE_OPENED",
    "TRADE_CLOSED",
    "SIGNAL_RECEIVED",
    "RISK_LIMIT_REACHED",
];

// Validate positive integer IDs.
const parseId = (value) => {
    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
};

// Format event response.
const formatBotEvent = (event) => ({
    id: event.id,
    botInstanceId: event.botInstanceId,
    eventType: event.eventType,
    message: event.message,
    details: event.details,
    createdAt: event.createdAt,
});

// GET ALL EVENTS FOR THE LOGGED-IN USER
export const getAllBotEvents = async (req, res) => {
    try {
        const requestedLimit = Number(req.query.limit ?? 50);

        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 50;

        const events = await prisma.botEvent.findMany({
            where: {
                botInstance: {
                    userId: req.user.id,
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
        });

        return res.status(200).json({
            success: true,
            count: events.length,
            events: events.map(formatBotEvent),
        });
    } catch (error) {
        console.error("Get all bot events error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve bot events.",
        });
    }
};

// GET EVENTS FOR ONE BOT INSTANCE
export const getBotEvents = async (req, res) => {
    try {
        const botInstanceId = parseId(req.params.id);

        if (!botInstanceId) {
            return res.status(400).json({
                success: false,
                message: "Invalid bot instance ID.",
            });
        }

        // Check that this bot belongs to the logged-in user.
        const bot = await prisma.botInstance.findFirst({
            where: {
                id: botInstanceId,
                userId: req.user.id,
            },
            select: {
                id: true,
            },
        });

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: "Bot instance not found.",
            });
        }

        const requestedLimit = Number(req.query.limit ?? 50);

        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 50;

        const events = await prisma.botEvent.findMany({
            where: {
                botInstanceId,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
        });

        return res.status(200).json({
            success: true,
            botInstanceId,
            count: events.length,
            events: events.map(formatBotEvent),
        });
    } catch (error) {
        console.error("Get bot events error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve events for this bot.",
        });
    }
};

// GET ONE EVENT
export const getBotEventById = async (req, res) => {
    try {
        const eventId = parseId(req.params.eventId);

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Invalid event ID.",
            });
        }

        const event = await prisma.botEvent.findFirst({
            where: {
                id: eventId,
                botInstance: {
                    userId: req.user.id,
                },
            },
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Bot event not found.",
            });
        }

        return res.status(200).json({
            success: true,
            event: formatBotEvent(event),
        });
    } catch (error) {
        console.error("Get bot event by ID error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve bot event.",
        });
    }
};

// CREATE A BOT EVENT
export const createBotEvent = async (req, res) => {
    try {
        const {
            botInstanceId: rawBotInstanceId,
            eventType,
            message,
            details,
        } = req.body;

        const botInstanceId = parseId(rawBotInstanceId);

        if (!botInstanceId) {
            return res.status(400).json({
                success: false,
                message: "A valid botInstanceId is required.",
            });
        }

        if (
            typeof eventType !== "string" ||
            !ALLOWED_EVENT_TYPES.includes(eventType)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid bot event type.",
                allowedTypes: ALLOWED_EVENT_TYPES,
            });
        }

        if (
            message !== undefined &&
            message !== null &&
            typeof message !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Message must be a string or null.",
            });
        }

        if (
            message !== undefined &&
            typeof message === "string" &&
            message.length > 2000
        ) {
            return res.status(400).json({
                success: false,
                message: "Message cannot exceed 2000 characters.",
            });
        }

        if (
            details !== undefined &&
            details !== null &&
            (
                typeof details !== "object" ||
                Array.isArray(details)
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Details must be a JSON object or null.",
            });
        }

        // Verify that the bot belongs to the authenticated user.
        const bot = await prisma.botInstance.findFirst({
            where: {
                id: botInstanceId,
                userId: req.user.id,
            },
            select: {
                id: true,
            },
        });

        if (!bot) {
            return res.status(404).json({
                success: false,
                message:
                    "Bot instance not found or does not belong to you.",
            });
        }

        const event = await prisma.botEvent.create({
            data: {
                botInstanceId,
                eventType,
                message: message ?? null,
                details: details ?? undefined,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Bot event recorded successfully.",
            event: formatBotEvent(event),
        });
    } catch (error) {
        console.error("Create bot event error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create bot event.",
        });
    }
};

// DELETE AN EVENT
export const deleteBotEvent = async (req, res) => {
    try {
        const eventId = parseId(req.params.eventId);

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Invalid event ID.",
            });
        }

        // Verify ownership before deletion.
        const event = await prisma.botEvent.findFirst({
            where: {
                id: eventId,
                botInstance: {
                    userId: req.user.id,
                },
            },
            select: {
                id: true,
            },
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Bot event not found.",
            });
        }

        await prisma.botEvent.delete({
            where: {
                id: eventId,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Bot event deleted successfully.",
        });
    } catch (error) {
        console.error("Delete bot event error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete bot event.",
        });
    }
};

