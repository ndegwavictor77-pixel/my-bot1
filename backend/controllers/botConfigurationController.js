


import { prisma } from "../config/db.js";

// Convert Prisma Decimal fields to strings for safe JSON responses.
const formatConfiguration = (config) => ({
    ...config,
    riskPercentPerTrade: config.riskPercentPerTrade.toString(),
    maxOpenRiskPercent: config.maxOpenRiskPercent.toString(),
    dailyLossLimitPercent: config.dailyLossLimitPercent.toString(),
    minRiskReward: config.minRiskReward.toString(),
    rsiBuyLevel: config.rsiBuyLevel.toString(),
    rsiSellLevel: config.rsiSellLevel.toString(),
    atrStopMultiplier: config.atrStopMultiplier.toString(),
});

// Validate positive integer IDs.
const parseId = (value) => {
    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// Allowed enum values.
// These must match your Prisma enums.
const STRATEGY_TYPES = [
    "HYBRID",
    "ICT",
    "SMC",
    "TECHNICAL",
];

const TRADING_MODES = [
    "ALL_QUALIFYING",
    "STRONGEST_SETUP",
];

// Validate and normalize configuration input.
const validateConfiguration = (body, isUpdate = false) => {
    const errors = [];
    const data = {};

    const stringFields = [
        "name",
        "description",
        "analysisTimeframe",
        "entryTimeframe",
    ];

    const booleanFields = [
        "enabled",
        "stopAfterDailyLoss",
        "useMarketStructure",
        "useBOS",
        "useCHOCH",
        "useLiquiditySweeps",
        "useOrderBlocks",
        "useFVG",
        "useIFVG",
        "useEMAFilter",
        "useRSIFilter",
        "useATRFilter",
        "allowBuy",
        "allowSell",
        "manageExistingTrades",
        "autoTrading",
    ];

    const integerFields = [
        "maxConsecutiveLosses",
        "maxOpenTrades",
        "maxSpreadPoints",
        "minConfluenceScore",
        "emaFastPeriod",
        "emaSlowPeriod",
        "rsiPeriod",
        "atrPeriod",
    ];

    const decimalFields = [
        "riskPercentPerTrade",
        "maxOpenRiskPercent",
        "dailyLossLimitPercent",
        "minRiskReward",
        "rsiBuyLevel",
        "rsiSellLevel",
        "atrStopMultiplier",
    ];

    const positiveIntegerFields = [
        "maxConsecutiveLosses",
        "maxOpenTrades",
        "emaFastPeriod",
        "emaSlowPeriod",
        "rsiPeriod",
        "atrPeriod",
    ];

    // Required fields when creating a configuration.
    if (!isUpdate) {
        if (
            typeof body.name !== "string" ||
            !body.name.trim()
        ) {
            errors.push("Configuration name is required.");
        }

        if (
            body.tradingAccountId === undefined ||
            !Number.isSafeInteger(Number(body.tradingAccountId)) ||
            Number(body.tradingAccountId) <= 0
        ) {
            errors.push("A valid tradingAccountId is required.");
        }
    }

    // Strings.
    for (const field of stringFields) {
        if (body[field] === undefined) continue;

        if (field === "description" && body[field] === null) {
            data[field] = null;
            continue;
        }

        if (typeof body[field] !== "string") {
            errors.push(`${field} must be a string.`);
            continue;
        }

        const value = body[field].trim();

        if (field === "name" && !value) {
            errors.push("Configuration name cannot be empty.");
            continue;
        }

        if (
            ["analysisTimeframe", "entryTimeframe"].includes(field) &&
            !["M1", "M5", "M15", "M30", "H1", "H4", "D1"].includes(value)
        ) {
            errors.push(
                `${field} must be one of M1, M5, M15, M30, H1, H4, or D1.`
            );
            continue;
        }

        data[field] = value;
    }

    // Booleans.
    for (const field of booleanFields) {
        if (body[field] === undefined) continue;

        if (typeof body[field] !== "boolean") {
            errors.push(`${field} must be true or false.`);
            continue;
        }

        data[field] = body[field];
    }

    // Integers.
    for (const field of integerFields) {
        if (body[field] === undefined) continue;

        if (
            !Number.isSafeInteger(body[field]) ||
            body[field] < 0
        ) {
            errors.push(`${field} must be a non-negative integer.`);
            continue;
        }

        if (
            positiveIntegerFields.includes(field) &&
            body[field] < 1
        ) {
            errors.push(`${field} must be greater than zero.`);
            continue;
        }

        if (
            field === "minConfluenceScore" &&
            body[field] > 100
        ) {
            errors.push("minConfluenceScore must be between 0 and 100.");
            continue;
        }

        data[field] = body[field];
    }

    // Decimal values.
    for (const field of decimalFields) {
        if (body[field] === undefined) continue;

        const value = body[field];

        if (
            value === null ||
            (typeof value !== "number" && typeof value !== "string") ||
            String(value).trim() === "" ||
            !Number.isFinite(Number(value))
        ) {
            errors.push(`${field} must be a valid number.`);
            continue;
        }

        const number = Number(value);

        if (
            [
                "riskPercentPerTrade",
                "maxOpenRiskPercent",
                "dailyLossLimitPercent",
                "minRiskReward",
                "atrStopMultiplier",
            ].includes(field) &&
            number <= 0
        ) {
            errors.push(`${field} must be greater than zero.`);
            continue;
        }

        if (
            ["rsiBuyLevel", "rsiSellLevel"].includes(field) &&
            (number < 0 || number > 100)
        ) {
            errors.push(`${field} must be between 0 and 100.`);
            continue;
        }

        if (
            number.toString().replace(".", "").replace("-", "").length > 5
        ) {
            errors.push(`${field} has too many digits.`);
            continue;
        }

        data[field] = number;
    }

    // Symbols.
    if (body.symbols !== undefined) {
        if (
            !Array.isArray(body.symbols) ||
            body.symbols.length === 0 ||
            body.symbols.some(
                (symbol) =>
                    typeof symbol !== "string" ||
                    !symbol.trim() ||
                    symbol.trim().length > 30
            )
        ) {
            errors.push(
                "symbols must be a non-empty array of valid symbol strings."
            );
        } else {
            const symbols = body.symbols.map((symbol) => symbol.trim());

            if (new Set(symbols).size !== symbols.length) {
                errors.push("symbols must not contain duplicates.");
            } else {
                data.symbols = symbols;
            }
        }
    }

    // Strategy enum.
    if (body.strategyType !== undefined) {
        if (!STRATEGY_TYPES.includes(body.strategyType)) {
            errors.push(
                `strategyType must be one of: ${STRATEGY_TYPES.join(", ")}.`
            );
        } else {
            data.strategyType = body.strategyType;
        }
    }

    // Trading mode enum.
    if (body.tradingMode !== undefined) {
        if (!TRADING_MODES.includes(body.tradingMode)) {
            errors.push(
                `tradingMode must be one of: ${TRADING_MODES.join(", ")}.`
            );
        } else {
            data.tradingMode = body.tradingMode;
        }
    }

    // Validate spread and related integer limits.
    if (
        data.maxSpreadPoints !== undefined &&
        data.maxSpreadPoints < 1
    ) {
        errors.push("maxSpreadPoints must be greater than zero.");
    }

    // Risk consistency checks.
    const risk = Number(
        data.riskPercentPerTrade ?? 0.5
    );

    const maxRisk = Number(
        data.maxOpenRiskPercent ?? 2.0
    );

    const dailyLimit = Number(
        data.dailyLossLimitPercent ?? 3.0
    );

    if (
        data.riskPercentPerTrade !== undefined &&
        data.maxOpenRiskPercent !== undefined &&
        risk > maxRisk
    ) {
        errors.push(
            "riskPercentPerTrade cannot exceed maxOpenRiskPercent."
        );
    }

    if (
        data.dailyLossLimitPercent !== undefined &&
        data.maxOpenRiskPercent !== undefined &&
        dailyLimit < 0
    ) {
        errors.push("dailyLossLimitPercent cannot be negative.");
    }

    return { errors, data };
};

// CREATE CONFIGURATION
export const createBotConfiguration = async (req, res) => {
    try {
        const { errors, data } = validateConfiguration(req.body);

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid configuration data.",
                errors,
            });
        }

        const userId = req.user.id;
        const tradingAccountId = Number(req.body.tradingAccountId);

        // Ensure the account belongs to this user.
        const account = await prisma.tradingAccount.findFirst({
            where: {
                id: tradingAccountId,
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

        // Prevent the configuration from silently exceeding account risk limits.
        const risk = Number(data.riskPercentPerTrade ?? 0.5);
        const maxRisk = Number(data.maxOpenRiskPercent ?? 2.0);

        if (risk > maxRisk) {
            return res.status(400).json({
                success: false,
                message:
                    "Risk per trade cannot exceed the maximum aggregate open risk.",
            });
        }

        // Always associate the configuration with the authenticated user.
        const configuration = await prisma.botConfiguration.create({
            data: {
                ...data,
                userId,
                tradingAccountId,
                name: data.name,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Bot configuration created successfully.",
            configuration: formatConfiguration(configuration),
        });
    } catch (error) {
        console.error("Create bot configuration error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create bot configuration.",
        });
    }
};

// GET ALL CONFIGURATIONS BELONGING TO THE USER
export const getBotConfigurations = async (req, res) => {
    try {
        const configurations = await prisma.botConfiguration.findMany({
            where: {
                userId: req.user.id,
            },
            include: {
                tradingAccount: {
                    select: {
                        id: true,
                        accountName: true,
                        broker: true,
                        server: true,
                        accountLogin: true,
                        environment: true,
                        status: true,
                        currency: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            count: configurations.length,
            configurations: configurations.map(formatConfiguration),
        });
    } catch (error) {
        console.error("Get bot configurations error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve bot configurations.",
        });
    }
};

// GET ONE CONFIGURATION
export const getBotConfigurationById = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid configuration ID.",
            });
        }

        const configuration = await prisma.botConfiguration.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
            include: {
                tradingAccount: {
                    select: {
                        id: true,
                        accountName: true,
                        broker: true,
                        server: true,
                        accountLogin: true,
                        environment: true,
                        status: true,
                        currency: true,
                    },
                },
            },
        });

        if (!configuration) {
            return res.status(404).json({
                success: false,
                message: "Bot configuration not found.",
            });
        }

        return res.status(200).json({
            success: true,
            configuration: formatConfiguration(configuration),
        });
    } catch (error) {
        console.error("Get bot configuration error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve bot configuration.",
        });
    }
};

// UPDATE CONFIGURATION
export const updateBotConfiguration = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid configuration ID.",
            });
        }

        const existing = await prisma.botConfiguration.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Bot configuration not found.",
            });
        }

        // Do not allow changing ownership through this endpoint.
        if (
            req.body.userId !== undefined ||
            req.body.id !== undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "You cannot change the configuration ID or owner.",
            });
        }

        const { errors, data } = validateConfiguration(req.body, true);

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid configuration data.",
                errors,
            });
        }

        // If the account is changed, verify that it belongs to this user.
        if (req.body.tradingAccountId !== undefined) {
            const tradingAccountId = Number(req.body.tradingAccountId);

            if (
                !Number.isSafeInteger(tradingAccountId) ||
                tradingAccountId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid tradingAccountId.",
                });
            }

            const account = await prisma.tradingAccount.findFirst({
                where: {
                    id: tradingAccountId,
                    userId: req.user.id,
                },
            });

            if (!account) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Trading account not found or does not belong to you.",
                });
            }

            data.tradingAccountId = tradingAccountId;
        }

        // Validate the resulting risk settings, not just the submitted fields.
        const risk = Number(
            data.riskPercentPerTrade ?? existing.riskPercentPerTrade
        );

        const maxRisk = Number(
            data.maxOpenRiskPercent ?? existing.maxOpenRiskPercent
        );

        if (risk > maxRisk) {
            return res.status(400).json({
                success: false,
                message:
                    "Risk per trade cannot exceed the maximum aggregate open risk.",
            });
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide at least one field to update.",
            });
        }

        const configuration = await prisma.botConfiguration.update({
            where: {
                id,
            },
            data,
        });

        return res.status(200).json({
            success: true,
            message: "Bot configuration updated successfully.",
            configuration: formatConfiguration(configuration),
        });
    } catch (error) {
        console.error("Update bot configuration error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update bot configuration.",
        });
    }
};

// ENABLE CONFIGURATION
export const enableBotConfiguration = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid configuration ID.",
            });
        }

        const existing = await prisma.botConfiguration.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Bot configuration not found.",
            });
        }

        const configuration = await prisma.botConfiguration.update({
            where: { id },
            data: { enabled: true },
        });

        return res.status(200).json({
            success: true,
            message:
                "Configuration enabled. The trading engine must still validate risk controls and connection status before executing trades.",
            configuration: formatConfiguration(configuration),
        });
    } catch (error) {
        console.error("Enable bot configuration error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to enable bot configuration.",
        });
    }
};

// DISABLE CONFIGURATION
export const disableBotConfiguration = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid configuration ID.",
            });
        }

        const existing = await prisma.botConfiguration.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Bot configuration not found.",
            });
        }

        const configuration = await prisma.botConfiguration.update({
            where: { id },
            data: {
                enabled: false,
                autoTrading: false,
            },
        });

        return res.status(200).json({
            success: true,
            message:
                "Configuration disabled and auto-trading switched off in the database.",
            configuration: formatConfiguration(configuration),
        });
    } catch (error) {
        console.error("Disable bot configuration error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to disable bot configuration.",
        });
    }
};

// DELETE CONFIGURATION
export const deleteBotConfiguration = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid configuration ID.",
            });
        }

        const existing = await prisma.botConfiguration.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Bot configuration not found.",
            });
        }

        await prisma.botConfiguration.delete({
            where: { id },
        });

        return res.status(200).json({
            success: true,
            message: "Bot configuration deleted successfully.",
        });
    } catch (error) {
        console.error("Delete bot configuration error:", error);

        if (
            error.code === "P2003" ||
            error.code === "P2014"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "This configuration has related trading records or bot instances and cannot be deleted. Disable it instead.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to delete bot configuration.",
        });
    }
};
