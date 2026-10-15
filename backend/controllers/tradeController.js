import { prisma } from "../config/db.js";

// CREATE TRADE
export const createTrade = async (req, res) => {
  try {
    const {
      tradingAccountId,
      configurationId,
      signalId,
      brokerPositionId,
      symbol,
      direction,
      volume,
      entryPrice,
      stopLoss,
      takeProfit,
      riskAmount,
      riskReward,
    } = req.body;

    // Validate required fields
    if (
      !tradingAccountId ||
      !configurationId ||
      !symbol ||
      !direction ||
      volume == null ||
      entryPrice == null
    ) {
      return res.status(400).json({
        success: false,
        message: "Required trade fields are missing",
      });
    }

    // Validate numeric values
    if (
      !Number.isFinite(Number(volume)) ||
      Number(volume) <= 0 ||
      !Number.isFinite(Number(entryPrice)) ||
      Number(entryPrice) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Volume and entry price must be positive numbers",
      });
    }

    // The authenticated user ID should come from your auth middleware.
    const userId = Number(req.user?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Verify account ownership
    const account = await prisma.tradingAccount.findFirst({
      where: {
        id: Number(tradingAccountId),
        userId,
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Trading account not found",
      });
    }

    // Verify configuration ownership if configurations belong to users.
    const configuration = await prisma.botConfiguration.findUnique({
      where: {
        id: Number(configurationId),
      },
    });

    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: "Bot configuration not found",
      });
    }

    // Create trade
    const trade = await prisma.trade.create({
      data: {
        user: {
          connect: { id: userId },
        },
        tradingAccount: {
          connect: { id: Number(tradingAccountId) },
        },
        configuration: {
          connect: { id: Number(configurationId) },
        },
        ...(signalId != null && {
          signal: {
            connect: { id: Number(signalId) },
          },
        }),
        brokerPositionId,
        symbol: symbol.toUpperCase(),
        direction,
        volume: String(volume),
        entryPrice: String(entryPrice),
        stopLoss:
          stopLoss == null ? null : String(stopLoss),
        takeProfit:
          takeProfit == null ? null : String(takeProfit),
        riskAmount:
          riskAmount == null ? null : String(riskAmount),
        riskReward:
          riskReward == null ? null : String(riskReward),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Trade created successfully",
      data: trade,
    });
  } catch (error) {
    console.error("Create trade error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create trade",
    });
  }
};


// GET ALL TRADES FOR AUTHENTICATED USER
export const getAllTrades = async (req, res) => {
  try {
    const userId = Number(req.user?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      status,
      symbol,
      tradingAccountId,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

    const where = {
      userId,
      ...(status && { status }),
      ...(symbol && {
        symbol: {
          equals: symbol,
          mode: "insensitive",
        },
      }),
      ...(tradingAccountId && {
        tradingAccountId: Number(tradingAccountId),
      }),
    };

    const [trades, total] = await prisma.$transaction([
      prisma.trade.findMany({
        where,
        include: {
          tradingAccount: true,
          configuration: true,
          signal: true,
          order: true,
        },
        orderBy: {
          openedAt: "desc",
        },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      }),
      prisma.trade.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: trades,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get trades error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve trades",
    });
  }
};


// GET SINGLE TRADE
export const getTradeById = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const tradeId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!Number.isInteger(tradeId) || tradeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid trade ID",
      });
    }

    const trade = await prisma.trade.findFirst({
      where: {
        id: tradeId,
        userId,
      },
      include: {
        tradingAccount: true,
        configuration: true,
        signal: true,
        order: true,
      },
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: trade,
    });
  } catch (error) {
    console.error("Get trade error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve trade",
    });
  }
};


// UPDATE TRADE
export const updateTrade = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const tradeId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!Number.isInteger(tradeId) || tradeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid trade ID",
      });
    }

    const existingTrade = await prisma.trade.findFirst({
      where: {
        id: tradeId,
        userId,
      },
    });

    if (!existingTrade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    // Only allow changes to these fields.
    const allowedFields = [
      "stopLoss",
      "takeProfit",
      "brokerPositionId",
      "riskAmount",
      "riskReward",
    ];

    const data = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        data[field] =
          req.body[field] === null
            ? null
            : String(req.body[field]);
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const trade = await prisma.trade.update({
      where: { id: tradeId },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Trade updated successfully",
      data: trade,
    });
  } catch (error) {
    console.error("Update trade error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update trade",
    });
  }
};


// CLOSE TRADE
export const closeTrade = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const tradeId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!Number.isInteger(tradeId) || tradeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid trade ID",
      });
    }

    const {
      exitPrice,
      profit,
      commission = 0,
      swap = 0,
      exitReason,
    } = req.body;

    if (
      exitPrice == null ||
      !Number.isFinite(Number(exitPrice)) ||
      Number(exitPrice) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid exit price is required",
      });
    }

    const existingTrade = await prisma.trade.findFirst({
      where: {
        id: tradeId,
        userId,
      },
    });

    if (!existingTrade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    if (existingTrade.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: "Only open trades can be closed",
      });
    }

    if (
      !Number.isFinite(Number(commission)) ||
      !Number.isFinite(Number(swap)) ||
      (profit != null && !Number.isFinite(Number(profit)))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid profit, commission, or swap value",
      });
    }

    // The broker should provide the actual realized profit.
    // Do not calculate Forex P/L from price difference alone:
    // contract size, lot size, tick value, and account currency matter.
    if (profit == null) {
      return res.status(400).json({
        success: false,
        message: "Actual realized profit from the broker is required",
      });
    }

    const grossProfit = Number(profit);
    const netProfit =
      grossProfit - Number(commission) + Number(swap);

    const trade = await prisma.$transaction(async (tx) => {
      // Recheck status inside the transaction to reduce race conditions.
      const currentTrade = await tx.trade.findFirst({
        where: {
          id: tradeId,
          userId,
        },
      });

      if (!currentTrade || currentTrade.status !== "OPEN") {
        throw new Error("TRADE_ALREADY_CLOSED");
      }

      return tx.trade.update({
        where: { id: tradeId },
        data: {
          status: "CLOSED",
          exitPrice: String(exitPrice),
          profit: String(grossProfit),
          commission: String(commission),
          swap: String(swap),
          netProfit: String(netProfit),
          ...(exitReason && { exitReason }),
          closedAt: new Date(),
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Trade closed successfully",
      data: trade,
    });
  } catch (error) {
    if (error.message === "TRADE_ALREADY_CLOSED") {
      return res.status(409).json({
        success: false,
        message: "Trade is already closed or no longer available",
      });
    }

    console.error("Close trade error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to close trade",
    });
  }
};


// DELETE TRADE
export const deleteTrade = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const tradeId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!Number.isInteger(tradeId) || tradeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid trade ID",
      });
    }

    const trade = await prisma.trade.findFirst({
      where: {
        id: tradeId,
        userId,
      },
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    await prisma.trade.delete({
      where: {
        id: tradeId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Trade deleted successfully",
    });
  } catch (error) {
    console.error("Delete trade error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete trade",
    });
  }
};