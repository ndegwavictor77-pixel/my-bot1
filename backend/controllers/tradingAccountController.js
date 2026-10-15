

import { prisma } from "../config/db.js";

// Convert Prisma Decimal values to strings for safe JSON responses.
const formatTradingAccount = (account) => ({
    id: account.id,
    userId: account.userId,
    accountName: account.accountName,
    broker: account.broker,
    server: account.server,
    accountLogin: account.accountLogin,
    environment: account.environment,
    status: account.status,
    currency: account.currency,

    balance: account.balance?.toString() ?? null,
    equity: account.equity?.toString() ?? null,
    margin: account.margin?.toString() ?? null,
    freeMargin: account.freeMargin?.toString() ?? null,

    leverage: account.leverage,
    lastConnectedAt: account.lastConnectedAt,
    lastHeartbeatAt: account.lastHeartbeatAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
});

// Validate account ID parameters.
const parseAccountId = (value) => {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

// CREATE TRADING ACCOUNT
export const createTradingAccount = async (req, res) => {
    try {
        const {
            accountName,
            broker,
            server,
            accountLogin,
            environment,
            currency,
            leverage,
        } = req.body;

        // Validate required fields.
        if (
            typeof accountLogin !== "string" ||
            !accountLogin.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "MT5 account login is required.",
            });
        }

        if (
            typeof server !== "string" ||
            !server.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "MT5 broker server is required.",
            });
        }

        if (
            environment !== undefined &&
            !["DEMO", "LIVE"].includes(environment)
        ) {
            return res.status(400).json({
                success: false,
                message: "Environment must be DEMO or LIVE.",
            });
        }

        if (
            leverage !== undefined &&
            leverage !== null &&
            (!Number.isInteger(leverage) || leverage < 1)
        ) {
            return res.status(400).json({
                success: false,
                message: "Leverage must be a positive integer.",
            });
        }

        if (
            currency !== undefined &&
            (
                typeof currency !== "string" ||
                !/^[A-Za-z]{3}$/.test(currency.trim())
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Currency must be a valid three-letter code, such as USD.",
            });
        }

        const userId = req.user.id;
        const normalizedLogin = accountLogin.trim();
        const normalizedServer = server.trim();

        // Check whether this account already belongs to this user.
        const existingAccount = await prisma.tradingAccount.findFirst({
            where: {
                userId,
                accountLogin: normalizedLogin,
                server: normalizedServer,
            },
        });

        if (existingAccount) {
            return res.status(409).json({
                success: false,
                message: "This trading account is already registered.",
            });
        }

        // Register the account.
        const account = await prisma.tradingAccount.create({
            data: {
                userId,

                accountName:
                    typeof accountName === "string"
                        ? accountName.trim() || null
                        : null,

                broker:
                    typeof broker === "string"
                        ? broker.trim() || null
                        : null,

                server: normalizedServer,
                accountLogin: normalizedLogin,
                environment: environment ?? "DEMO",

                currency:
                    typeof currency === "string"
                        ? currency.trim().toUpperCase()
                        : "USD",

                leverage: leverage ?? null,

                // The MT5 terminal must connect before this account
                // can be considered connected.
                status: "INACTIVE",
            },
        });

        return res.status(201).json({
            success: true,
            message:
                "Trading account registered successfully. Connect your MT5 terminal to begin monitoring.",
            account: formatTradingAccount(account),
        });
    } catch (error) {
        console.error("Create trading account error:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "A trading account with these details already exists.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to register trading account.",
        });
    }
};

// GET ALL TRADING ACCOUNTS FOR THE LOGGED-IN USER
export const getTradingAccounts = async (req, res) => {
    try {
        const accounts = await prisma.tradingAccount.findMany({
            where: {
                userId: req.user.id,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            count: accounts.length,
            accounts: accounts.map(formatTradingAccount),
        });
    } catch (error) {
        console.error("Get trading accounts error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve trading accounts.",
        });
    }
};

// GET ONE TRADING ACCOUNT
export const getTradingAccountById = async (req, res) => {
    try {
        const id = parseAccountId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid trading account ID.",
            });
        }

        // Restrict access to accounts owned by the logged-in user.
        const account = await prisma.tradingAccount.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Trading account not found.",
            });
        }

        return res.status(200).json({
            success: true,
            account: formatTradingAccount(account),
        });
    } catch (error) {
        console.error("Get trading account error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve trading account.",
        });
    }
};

// UPDATE EDITABLE TRADING ACCOUNT DETAILS
export const updateTradingAccount = async (req, res) => {
    try {
        const id = parseAccountId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid trading account ID.",
            });
        }

        const {
            accountName,
            broker,
            server,
            accountLogin,
            environment,
            currency,
            leverage,
        } = req.body;

        // Ensure the account belongs to the logged-in user.
        const existingAccount = await prisma.tradingAccount.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!existingAccount) {
            return res.status(404).json({
                success: false,
                message: "Trading account not found.",
            });
        }

        const data = {};

        if (accountName !== undefined) {
            if (
                accountName !== null &&
                typeof accountName !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Account name must be a string or null.",
                });
            }

            data.accountName =
                typeof accountName === "string"
                    ? accountName.trim() || null
                    : null;
        }

        if (broker !== undefined) {
            if (broker !== null && typeof broker !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Broker must be a string or null.",
                });
            }

            data.broker =
                typeof broker === "string"
                    ? broker.trim() || null
                    : null;
        }

        if (server !== undefined) {
            if (
                typeof server !== "string" ||
                !server.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Server must be a non-empty string.",
                });
            }

            data.server = server.trim();
        }

        if (accountLogin !== undefined) {
            if (
                typeof accountLogin !== "string" ||
                !accountLogin.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Account login must be a non-empty string.",
                });
            }

            data.accountLogin = accountLogin.trim();
        }

        if (environment !== undefined) {
            if (!["DEMO", "LIVE"].includes(environment)) {
                return res.status(400).json({
                    success: false,
                    message: "Environment must be DEMO or LIVE.",
                });
            }

            data.environment = environment;
        }

        if (currency !== undefined) {
            if (
                typeof currency !== "string" ||
                !/^[A-Za-z]{3}$/.test(currency.trim())
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Currency must be a valid three-letter code, such as USD.",
                });
            }

            data.currency = currency.trim().toUpperCase();
        }

        if (leverage !== undefined) {
            if (
                leverage !== null &&
                (!Number.isInteger(leverage) || leverage < 1)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Leverage must be a positive integer or null.",
                });
            }

            data.leverage = leverage;
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide at least one editable field to update.",
            });
        }

        // Check the resulting account identity before updating.
        const resultingLogin =
            data.accountLogin ?? existingAccount.accountLogin;

        const resultingServer =
            data.server ?? existingAccount.server;

        const duplicate = await prisma.tradingAccount.findFirst({
            where: {
                userId: req.user.id,
                accountLogin: resultingLogin,
                server: resultingServer,
                NOT: {
                    id,
                },
            },
        });

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: "Another registered account already uses this login and server.",
            });
        }

        const updatedAccount = await prisma.tradingAccount.update({
            where: {
                id,
            },
            data,
        });

        return res.status(200).json({
            success: true,
            message: "Trading account updated successfully.",
            account: formatTradingAccount(updatedAccount),
        });
    } catch (error) {
        console.error("Update trading account error:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "An account with these details already exists.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update trading account.",
        });
    }
};

// DISCONNECT / MARK ACCOUNT INACTIVE
export const disconnectTradingAccount = async (req, res) => {
    try {
        const id = parseAccountId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid trading account ID.",
            });
        }

        const existingAccount = await prisma.tradingAccount.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!existingAccount) {
            return res.status(404).json({
                success: false,
                message: "Trading account not found.",
            });
        }

        const account = await prisma.tradingAccount.update({
            where: {
                id,
            },
            data: {
                status: "INACTIVE",
            },
        });

        return res.status(200).json({
            success: true,
            message:
                "Trading account marked inactive. Ensure your MT5 Expert Advisor and terminal stop executing trades if you intend to stop trading.",
            account: formatTradingAccount(account),
        });
    } catch (error) {
        console.error("Disconnect trading account error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to mark trading account inactive.",
        });
    }
};

// DELETE TRADING ACCOUNT
export const deleteTradingAccount = async (req, res) => {
    try {
        const id = parseAccountId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid trading account ID.",
            });
        }

        const existingAccount = await prisma.tradingAccount.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!existingAccount) {
            return res.status(404).json({
                success: false,
                message: "Trading account not found.",
            });
        }

        await prisma.tradingAccount.delete({
            where: {
                id,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Trading account deleted successfully.",
        });
    } catch (error) {
        console.error("Delete trading account error:", error);

        if (error.code === "P2003" || error.code === "P2014") {
            return res.status(409).json({
                success: false,
                message:
                    "This account has related trading records and cannot be deleted. Keep it registered and mark it inactive instead.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to delete trading account.",
        });
    }
};

