import { prisma } from "../config/db.js";

// ======================================================
// HELPER FUNCTIONS
// ======================================================

// Format Decimal values for JSON responses
const formatSignal = (signal) => {
    if (!signal) return signal;

    return {
        ...signal,
        entryPrice: signal.entryPrice?.toString() ?? null,
        stopLoss: signal.stopLoss?.toString() ?? null,
        takeProfit: signal.takeProfit?.toString() ?? null,
        configuration: signal.configuration
            ? {
                  ...signal.configuration,
              }
            : undefined,
    };
};

// Validate a positive decimal price
const isValidPrice = (value) => {
    if (value === null || value === undefined || value === "") {
        return false;
    }

    return (
        (typeof value === "number" || typeof value === "string") &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0
    );
};

// Validate signal direction
const validDirections = ["BUY", "SELL"];

// Uses the SignalType enum supplied in your Prisma schema
const validSignalTypes = [
    "BOS",
    "CHOCH",
    "LIQUIDITY_SWEEP",
    "ORDER_BLOCK",
    "FVG",
    "IFVG",
    "EMA_CROSSOVER",
    "RSI_CONFIRMATION",
    "ATR_FILTER",
    "COMBINED",
];

// Update this array if your actual SignalStatus enum differs
const validSignalStatuses = [
    "NEW",
    "APPROVED",
    "EXECUTED",
    "EXPIRED",
    "CANCELLED",
    "REJECTED",
];

const validTimeframes = [
    "M1",
    "M5",
    "M15",
    "M30",
    "H1",
    "H4",
    "D1",
    "W1",
    "MN1",
];

// Check whether the configuration belongs to the logged-in user
const getOwnedConfiguration = async (configurationId, userId) => {
    return prisma.botConfiguration.findFirst({
        where: {
            id: configurationId,
            userId,
        },
    });
};

// Validate BUY/SELL entry, stop-loss, and take-profit prices
const validateTradePrices = ({
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
}) => {
    if (
        entryPrice == null ||
        stopLoss == null ||
        takeProfit == null
    ) {
        return true;
    }

    const entry = Number(entryPrice);
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);

    if (
        !Number.isFinite(entry) ||
        !Number.isFinite(sl) ||
        !Number.isFinite(tp)
    ) {
        return false;
    }

    if (direction === "BUY") {
        return sl < entry && tp > entry;
    }

    if (direction === "SELL") {
        return sl > entry && tp < entry;
    }

    return false;
};

// ======================================================
// 1. CREATE TRADE SIGNAL
// POST /api/trade-signals
// ======================================================

export const createTradeSignal = async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            configurationId,
            symbol,
            direction,
            signalType,
            analysisTimeframe,
            entryTimeframe,
            entryPrice,
            stopLoss,
            takeProfit,
            confidenceScore,
            reason,
            metadata,
            expiresAt,
        } = req.body;

        // Validate required fields
        if (
            configurationId === undefined ||
            configurationId === null ||
            !symbol ||
            !direction
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "configurationId, symbol, and direction are required.",
            });
        }

        const configId = Number(configurationId);

        if (!Number.isInteger(configId) || configId <= 0) {
            return res.status(400).json({
                success: false,
                message: "configurationId must be a positive integer.",
            });
        }

        if (typeof symbol !== "string" || !symbol.trim()) {
            return res.status(400).json({
                success: false,
                message: "symbol must be a non-empty string.",
            });
        }

        const normalizedSymbol = symbol.trim().toUpperCase();

        if (normalizedSymbol.length > 30) {
            return res.status(400).json({
                success: false,
                message: "symbol cannot exceed 30 characters.",
            });
        }

        if (!validDirections.includes(direction)) {
            return res.status(400).json({
                success: false,
                message: "direction must be BUY or SELL.",
            });
        }

        // Validate signal type
        if (
            signalType !== undefined &&
            !validSignalTypes.includes(signalType)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid signalType.",
                allowedValues: validSignalTypes,
            });
        }

        // Validate timeframes
        if (
            analysisTimeframe !== undefined &&
            !validTimeframes.includes(analysisTimeframe)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid analysisTimeframe.",
            });
        }

        if (
            entryTimeframe !== undefined &&
            !validTimeframes.includes(entryTimeframe)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid entryTimeframe.",
            });
        }

        // Validate confidence score
        const score =
            confidenceScore === undefined
                ? 0
                : Number(confidenceScore);

        if (
            !Number.isInteger(score) ||
            score < 0 ||
            score > 100
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "confidenceScore must be an integer between 0 and 100.",
            });
        }

        // Validate optional prices
        for (const [field, value] of Object.entries({
            entryPrice,
            stopLoss,
            takeProfit,
        })) {
            if (
                value !== undefined &&
                value !== null &&
                !isValidPrice(value)
            ) {
                return res.status(400).json({
                    success: false,
                    message: `${field} must be a positive number or null.`,
                });
            }
        }

        if (
            !validateTradePrices({
                direction,
                entryPrice,
                stopLoss,
                takeProfit,
            })
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid entry, stop-loss, or take-profit prices for this direction.",
            });
        }

        // Validate metadata
        if (metadata !== undefined && metadata !== null) {
            if (
                typeof metadata !== "object" ||
                Array.isArray(metadata)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "metadata must be a JSON object or null.",
                });
            }
        }

        // Validate expiry date
        let parsedExpiry;

        if (expiresAt !== undefined && expiresAt !== null) {
            parsedExpiry = new Date(expiresAt);

            if (Number.isNaN(parsedExpiry.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid expiresAt date.",
                });
            }

            if (parsedExpiry <= new Date()) {
                return res.status(400).json({
                    success: false,
                    message: "expiresAt must be in the future.",
                });
            }
        }

        // Check configuration ownership
        const configuration = await getOwnedConfiguration(
            configId,
            userId
        );

        if (!configuration) {
            return res.status(404).json({
                success: false,
                message:
                    "Configuration not found or does not belong to you.",
            });
        }

        if (!configuration.enabled) {
            return res.status(400).json({
                success: false,
                message:
                    "Cannot create a signal for a disabled configuration.",
            });
        }

        // Create signal
        const signal = await prisma.tradeSignal.create({
            data: {
                userId,
                configurationId: configId,
                symbol: normalizedSymbol,
                direction,
                signalType: signalType ?? "COMBINED",
                analysisTimeframe: analysisTimeframe ?? "M15",
                entryTimeframe: entryTimeframe ?? "M5",
                entryPrice:
                    entryPrice === undefined || entryPrice === null
                        ? null
                        : String(entryPrice),
                stopLoss:
                    stopLoss === undefined || stopLoss === null
                        ? null
                        : String(stopLoss),
                takeProfit:
                    takeProfit === undefined || takeProfit === null
                        ? null
                        : String(takeProfit),
                confidenceScore: score,
                reason: reason ?? null,
                metadata: metadata ?? undefined,
                expiresAt: parsedExpiry ?? null,
            },
            include: {
                configuration: {
                    select: {
                        id: true,
                        name: true,
                        strategyType: true,
                    },
                },
            },
        });

        return res.status(201).json({
            success: true,
            message: "Trade signal created successfully.",
            signal: formatSignal(signal),
        });
    } catch (error) {
        console.error("Create trade signal error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create trade signal.",
        });
    }
};

// ======================================================
// 2. GET ALL USER SIGNALS
// GET /api/trade-signals
// ======================================================

export const getTradeSignals = async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            symbol,
            direction,
            status,
            signalType,
            configurationId,
            page = "1",
            limit = "20",
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            !Number.isInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > 100
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "page must be positive and limit must be between 1 and 100.",
            });
        }

        const where = { userId };

        if (symbol !== undefined) {
            if (
                typeof symbol !== "string" ||
                !symbol.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid symbol filter.",
                });
            }

            where.symbol = symbol.trim().toUpperCase();
        }

        if (direction !== undefined) {
            if (!validDirections.includes(direction)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid direction filter.",
                });
            }

            where.direction = direction;
        }

        if (status !== undefined) {
            if (!validSignalStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status filter.",
                    allowedValues: validSignalStatuses,
                });
            }

            where.status = status;
        }

        if (signalType !== undefined) {
            if (!validSignalTypes.includes(signalType)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid signalType filter.",
                    allowedValues: validSignalTypes,
                });
            }

            where.signalType = signalType;
        }

        if (configurationId !== undefined) {
            const configId = Number(configurationId);

            if (!Number.isInteger(configId) || configId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid configurationId filter.",
                });
            }

            where.configurationId = configId;
        }

        const [signals, total] = await prisma.$transaction([
            prisma.tradeSignal.findMany({
                where,
                orderBy: {
                    generatedAt: "desc",
                },
                skip: (pageNumber - 1) * pageSize,
                take: pageSize,
                include: {
                    configuration: {
                        select: {
                            id: true,
                            name: true,
                            strategyType: true,
                        },
                    },
                },
            }),
            prisma.tradeSignal.count({ where }),
        ]);

        return res.status(200).json({
            success: true,
            total,
            page: pageNumber,
            limit: pageSize,
            totalPages: Math.ceil(total / pageSize),
            signals: signals.map(formatSignal),
        });
    } catch (error) {
        console.error("Get trade signals error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve trade signals.",
        });
    }
};

// ======================================================
// 3. GET ONE SIGNAL
// GET /api/trade-signals/:id
// ======================================================

export const getTradeSignalById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid signal ID.",
            });
        }

        const signal = await prisma.tradeSignal.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
            include: {
                configuration: {
                    select: {
                        id: true,
                        name: true,
                        strategyType: true,
                    },
                },
                trades: true,
            },
        });

        if (!signal) {
            return res.status(404).json({
                success: false,
                message:
                    "Trade signal not found or does not belong to you.",
            });
        }

        return res.status(200).json({
            success: true,
            signal: formatSignal(signal),
        });
    } catch (error) {
        console.error("Get trade signal by ID error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve trade signal.",
        });
    }
};

// ======================================================
// 4. UPDATE A NEW SIGNAL
// PATCH /api/trade-signals/:id
// ======================================================

export const updateTradeSignal = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid signal ID.",
            });
        }

        const existing = await prisma.tradeSignal.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message:
                    "Trade signal not found or does not belong to you.",
            });
        }

        if (existing.status !== "NEW") {
            return res.status(400).json({
                success: false,
                message: "Only NEW signals can be updated.",
            });
        }

        const allowedFields = [
            "symbol",
            "direction",
            "signalType",
            "analysisTimeframe",
            "entryTimeframe",
            "entryPrice",
            "stopLoss",
            "takeProfit",
            "confidenceScore",
            "reason",
            "metadata",
            "expiresAt",
        ];

        const data = {};

        for (const field of allowedFields) {
            if (Object.hasOwn(req.body, field)) {
                data[field] = req.body[field];
            }
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields supplied for update.",
            });
        }

        if (data.symbol !== undefined) {
            if (
                typeof data.symbol !== "string" ||
                !data.symbol.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "symbol must be a non-empty string.",
                });
            }

            data.symbol = data.symbol.trim().toUpperCase();
        }

        if (
            data.direction !== undefined &&
            !validDirections.includes(data.direction)
        ) {
            return res.status(400).json({
                success: false,
                message: "direction must be BUY or SELL.",
            });
        }

        if (
            data.signalType !== undefined &&
            !validSignalTypes.includes(data.signalType)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid signalType.",
                allowedValues: validSignalTypes,
            });
        }

        for (const field of [
            "analysisTimeframe",
            "entryTimeframe",
        ]) {
            if (
                data[field] !== undefined &&
                !validTimeframes.includes(data[field])
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid ${field}.`,
                });
            }
        }

        if (data.confidenceScore !== undefined) {
            data.confidenceScore = Number(data.confidenceScore);

            if (
                !Number.isInteger(data.confidenceScore) ||
                data.confidenceScore < 0 ||
                data.confidenceScore > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "confidenceScore must be between 0 and 100.",
                });
            }
        }

        for (const field of [
            "entryPrice",
            "stopLoss",
            "takeProfit",
        ]) {
            if (
                data[field] !== undefined &&
                data[field] !== null
            ) {
                if (!isValidPrice(data[field])) {
                    return res.status(400).json({
                        success: false,
                        message: `${field} must be a positive number or null.`,
                    });
                }

                data[field] = String(data[field]);
            }
        }

        if (data.metadata !== undefined && data.metadata !== null) {
            if (
                typeof data.metadata !== "object" ||
                Array.isArray(data.metadata)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "metadata must be a JSON object or null.",
                });
            }
        }

        if (data.expiresAt !== undefined) {
            if (data.expiresAt === null) {
                data.expiresAt = null;
            } else {
                const expiry = new Date(data.expiresAt);

                if (
                    Number.isNaN(expiry.getTime()) ||
                    expiry <= new Date()
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "expiresAt must be a valid future date or null.",
                    });
                }

                data.expiresAt = expiry;
            }
        }

        const direction = data.direction ?? existing.direction;

        const entryPrice =
            data.entryPrice !== undefined
                ? data.entryPrice
                : existing.entryPrice?.toString() ?? null;

        const stopLoss =
            data.stopLoss !== undefined
                ? data.stopLoss
                : existing.stopLoss?.toString() ?? null;

        const takeProfit =
            data.takeProfit !== undefined
                ? data.takeProfit
                : existing.takeProfit?.toString() ?? null;

        if (
            !validateTradePrices({
                direction,
                entryPrice,
                stopLoss,
                takeProfit,
            })
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Entry, stop-loss, and take-profit prices do not match the signal direction.",
            });
        }

        const signal = await prisma.tradeSignal.update({
            where: { id },
            data,
        });

        return res.status(200).json({
            success: true,
            message: "Trade signal updated successfully.",
            signal: formatSignal(signal),
        });
    } catch (error) {
        console.error("Update trade signal error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update trade signal.",
        });
    }
};

// ======================================================
// 5. MARK SIGNAL AS PROCESSING
// PATCH /api/trade-signals/:id/process
// ======================================================

export const processTradeSignal = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid signal ID.",
            });
        }

        const signal = await prisma.tradeSignal.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!signal) {
            return res.status(404).json({
                success: false,
                message:
                    "Trade signal not found or does not belong to you.",
            });
        }

        if (signal.status !== "NEW") {
            return res.status(400).json({
                success: false,
                message: "Only NEW signals can be processed.",
            });
        }

        if (
            signal.expiresAt &&
            signal.expiresAt <= new Date()
        ) {
            const expiredSignal = await prisma.tradeSignal.update({
                where: { id },
                data: {
                    status: "EXPIRED",
                },
            });

            return res.status(400).json({
                success: false,
                message: "This signal has expired.",
                signal: formatSignal(expiredSignal),
            });
        }

        // Conditional update prevents two requests from processing
        // the same NEW signal at the same time.
        const result = await prisma.tradeSignal.updateMany({
            where: {
                id,
                userId: req.user.id,
                status: "NEW",
            },
            data: {
                status: "PROCESSING",
                processedAt: new Date(),
            },
        });

        if (result.count === 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Signal was already processed by another request.",
            });
        }

        const updated = await prisma.tradeSignal.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Signal marked as processing.",
            signal: formatSignal(updated),
        });
    } catch (error) {
        console.error("Process trade signal error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to process trade signal.",
        });
    }
};

// ======================================================
// 6. DELETE A NEW SIGNAL
// DELETE /api/trade-signals/:id
// ======================================================

export const deleteTradeSignal = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid signal ID.",
            });
        }

        const signal = await prisma.tradeSignal.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!signal) {
            return res.status(404).json({
                success: false,
                message:
                    "Trade signal not found or does not belong to you.",
            });
        }

        if (signal.status !== "NEW") {
            return res.status(400).json({
                success: false,
                message: "Only NEW signals can be deleted.",
            });
        }

        // Delete only if it is still NEW
        const result = await prisma.tradeSignal.deleteMany({
            where: {
                id,
                userId: req.user.id,
                status: "NEW",
            },
        });

        if (result.count === 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Signal can no longer be deleted because its status changed.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Trade signal deleted successfully.",
        });
    } catch (error) {
        console.error("Delete trade signal error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete trade signal.",
        });
    }
};