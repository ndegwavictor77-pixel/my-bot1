import { randomUUID } from "node:crypto";
import { prisma } from "../config/db.js";

// ======================================================
// ENUM VALUES
// Update these to match your actual Prisma enums.
// ======================================================

const VALID_ORDER_TYPES = [
    "MARKET",
    "BUY-LIMIT",
    "SELL-LIMIT",
    "BUY-STOP",
    "SELL-STOP",
];

const VALID_DIRECTIONS = ["BUY", "SELL"];

const VALID_ORDER_STATUSES = [
    "PENDING",
    "SUBMITTED",
    "FILLED",
    "PARTIALLY_FILLED",
    "CANCELLED",
    "REJECTED",
    "EXPIRED",
];

// ======================================================
// HELPERS
// ======================================================

const formatOrder = (order) => ({
    ...order,
    volume: order.volume.toString(),
    requestedPrice: order.requestedPrice?.toString() ?? null,
    filledPrice: order.filledPrice?.toString() ?? null,
    stopLoss: order.stopLoss?.toString() ?? null,
    takeProfit: order.takeProfit?.toString() ?? null,
});

const isPositiveNumber = (value) => {
    if (
        typeof value !== "number" &&
        typeof value !== "string"
    ) {
        return false;
    }

    return (
        String(value).trim() !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0
    );
};

const parseOrderId = (value) => {
    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// Ownership check through the related Trade.
// This requires Trade.userId to exist in your schema.
const getOwnedTrade = async (tradeId, userId) => {
    return prisma.trade.findFirst({
        where: {
            id: tradeId,
            userId,
        },
    });
};

// ======================================================
// 1. CREATE ORDER
// POST /api/trade-orders
// ======================================================

export const createTradeOrder = async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            symbol,
            orderType,
            direction,
            volume,
            requestedPrice,
            stopLoss,
            takeProfit,
            comment,
            tradeId,
            clientOrderId,
        } = req.body;

        if (
            !symbol ||
            !orderType ||
            !direction ||
            volume === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "symbol, orderType, direction, and volume are required.",
            });
        }

        if (
            typeof symbol !== "string" ||
            !symbol.trim() ||
            symbol.trim().length > 30
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid symbol.",
            });
        }

        const normalizedSymbol = symbol.trim().toUpperCase();

        if (!VALID_ORDER_TYPES.includes(orderType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid orderType.",
                allowedValues: VALID_ORDER_TYPES,
            });
        }

        if (!VALID_DIRECTIONS.includes(direction)) {
            return res.status(400).json({
                success: false,
                message: "direction must be BUY or SELL.",
            });
        }

        if (!isPositiveNumber(volume)) {
            return res.status(400).json({
                success: false,
                message: "volume must be a positive number.",
            });
        }

        for (const [field, value] of Object.entries({
            requestedPrice,
            stopLoss,
            takeProfit,
        })) {
            if (
                value !== undefined &&
                value !== null &&
                !isPositiveNumber(value)
            ) {
                return res.status(400).json({
                    success: false,
                    message: `${field} must be a positive number or null.`,
                });
            }
        }

        // LIMIT and STOP_LIMIT orders usually require an entry price.
        if (
            ["LIMIT", "STOP_LIMIT"].includes(orderType) &&
            !isPositiveNumber(requestedPrice)
        ) {
            return res.status(400).json({
                success: false,
                message: `${orderType} orders require requestedPrice.`,
            });
        }

        // Verify optional Trade ownership.
        let validatedTradeId = null;

        if (tradeId !== undefined && tradeId !== null) {
            const parsedTradeId = parseOrderId(tradeId);

            if (!parsedTradeId) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid tradeId.",
                });
            }

            const trade = await getOwnedTrade(
                parsedTradeId,
                userId
            );

            if (!trade) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Trade not found or does not belong to you.",
                });
            }

            validatedTradeId = parsedTradeId;
        }

        // A client-generated id supports safe retries.
        const safeClientOrderId =
            typeof clientOrderId === "string" &&
            clientOrderId.trim()
                ? clientOrderId.trim()
                : randomUUID();

        if (safeClientOrderId.length > 100) {
            return res.status(400).json({
                success: false,
                message: "clientOrderId cannot exceed 100 characters.",
            });
        }

        const existingOrder = await prisma.tradeOrder.findUnique({
            where: {
                clientOrderId: safeClientOrderId,
            },
        });

        if (existingOrder) {
            return res.status(409).json({
                success: false,
                message:
                    "An order with this clientOrderId already exists.",
            });
        }

        const order = await prisma.tradeOrder.create({
            data: {
                clientOrderId: safeClientOrderId,
                symbol: normalizedSymbol,
                orderType,
                direction,
                volume: String(volume),
                requestedPrice:
                    requestedPrice === undefined ||
                    requestedPrice === null
                        ? null
                        : String(requestedPrice),
                stopLoss:
                    stopLoss === undefined || stopLoss === null
                        ? null
                        : String(stopLoss),
                takeProfit:
                    takeProfit === undefined || takeProfit === null
                        ? null
                        : String(takeProfit),
                comment:
                    typeof comment === "string"
                        ? comment.trim().slice(0, 500)
                        : null,
                tradeId: validatedTradeId,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Trade order created successfully.",
            order: formatOrder(order),
        });
    } catch (error) {
        console.error("Create trade order error:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "An order with that clientOrderId already exists.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create trade order.",
        });
    }
};

// ======================================================
// 2. GET USER'S ORDERS
// GET /api/trade-orders
// ======================================================

export const getTradeOrders = async (req, res) => {
    try {
        const {
            symbol,
            status,
            direction,
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

        // IMPORTANT:
        // TradeOrder has no userId, so only orders linked to a
        // Trade owned by the logged-in user can be safely queried.
        const ownedTrades = await prisma.trade.findMany({
            where: {
                userId: req.user.id,
            },
            select: {
                id: true,
            },
        });

        const where = {
            tradeId: {
                in: ownedTrades.map((trade) => trade.id),
            },
        };

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

        if (status !== undefined) {
            if (!VALID_ORDER_STATUSES.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status filter.",
                    allowedValues: VALID_ORDER_STATUSES,
                });
            }

            where.status = status;
        }

        if (direction !== undefined) {
            if (!VALID_DIRECTIONS.includes(direction)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid direction filter.",
                });
            }

            where.direction = direction;
        }

        const [orders, total] = await prisma.$transaction([
            prisma.tradeOrder.findMany({
                where,
                orderBy: {
                    createdAt: "desc",
                },
                skip: (pageNumber - 1) * pageSize,
                take: pageSize,
            }),
            prisma.tradeOrder.count({ where }),
        ]);

        return res.status(200).json({
            success: true,
            total,
            page: pageNumber,
            limit: pageSize,
            totalPages: Math.ceil(total / pageSize),
            orders: orders.map(formatOrder),
        });
    } catch (error) {
        console.error("Get trade orders error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve trade orders.",
        });
    }
};

// ======================================================
// 3. GET ONE ORDER
// GET /api/trade-orders/:id
// ======================================================

export const getTradeOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await prisma.tradeOrder.findUnique({
            where: { id },
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Trade order not found.",
            });
        }

        // An unlinked order cannot be attributed to a user
        // using the schema as currently provided.
        if (order.tradeId === null) {
            return res.status(403).json({
                success: false,
                message:
                    "This order has no ownership relationship. Add userId to TradeOrder to manage unlinked orders safely.",
            });
        }

        const trade = await getOwnedTrade(
            order.tradeId,
            req.user.id
        );

        if (!trade) {
            return res.status(404).json({
                success: false,
                message:
                    "Trade order not found or does not belong to you.",
            });
        }

        return res.status(200).json({
            success: true,
            order: formatOrder(order),
        });
    } catch (error) {
        console.error("Get trade order error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve trade order.",
        });
    }
};

// ======================================================
// 4. CANCEL AN ORDER
// PATCH /api/trade-orders/:id/cancel
// ======================================================

export const cancelTradeOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await prisma.tradeOrder.findUnique({
            where: { id },
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Trade order not found.",
            });
        }

        if (order.tradeId === null) {
            return res.status(403).json({
                success: false,
                message:
                    "Cannot verify ownership of this unlinked order.",
            });
        }

        const trade = await getOwnedTrade(
            order.tradeId,
            req.user.id
        );

        if (!trade) {
            return res.status(404).json({
                success: false,
                message:
                    "Trade order not found or does not belong to you.",
            });
        }

        if (!["PENDING", "SUBMITTED"].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message:
                    "Only pending or submitted orders can be cancelled.",
            });
        }

        // This updates the database only.
        // The backend/EA must also send a cancellation request
        // to the broker and confirm its result.
        const updatedOrder = await prisma.tradeOrder.updateMany({
            where: {
                id,
                status: order.status,
                tradeId: order.tradeId,
            },
            data: {
                status: "CANCELLED",
                cancelledAt: new Date(),
            },
        });

        if (updatedOrder.count === 0) {
            return res.status(409).json({
                success: false,
                message:
                    "The order status changed. Refresh and try again.",
            });
        }

        const result = await prisma.tradeOrder.findUnique({
            where: { id },
        });

        return res.status(200).json({
            success: true,
            message:
                "Order marked as cancelled in the database. Confirm broker cancellation separately.",
            order: formatOrder(result),
        });
    } catch (error) {
        console.error("Cancel trade order error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to cancel trade order.",
        });
    }
};