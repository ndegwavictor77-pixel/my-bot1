-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TradingAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONNECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AccountEnvironment" AS ENUM ('DEMO', 'LIVE');

-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('STOPPED', 'STARTING', 'RUNNING', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "TradingMode" AS ENUM ('ALL_QUALIFYING', 'STRONGEST_SETUP');

-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('ICT_SMC', 'TECHNICAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "TradeDirection" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('NEW', 'APPROVED', 'REJECTED', 'EXECUTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('BOS', 'CHOCH', 'LIQUIDITY_SWEEP', 'ORDER_BLOCK', 'FVG', 'IFVG', 'EMA_CROSSOVER', 'RSI_CONFIRMATION', 'ATR_FILTER', 'COMBINED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SUBMITTED', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExitReason" AS ENUM ('TAKE_PROFIT', 'STOP_LOSS', 'MANUAL', 'TRAILING_STOP', 'DAILY_RISK_LIMIT', 'STRATEGY_EXIT', 'OTHER');

-- CreateEnum
CREATE TYPE "BotEventType" AS ENUM ('CONNECTED', 'DISCONNECTED', 'STARTED', 'STOPPED', 'PAUSED', 'RESUMED', 'ERROR', 'HEARTBEAT', 'CONFIG_UPDATED', 'TRADE_OPENED', 'TRADE_CLOSED', 'SIGNAL_RECEIVED', 'RISK_LIMIT_REACHED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'BOT_STARTED', 'BOT_STOPPED', 'TRADE_EXECUTED', 'CONFIG_CHANGED', 'ACCOUNT_CONNECTED', 'ACCOUNT_DISCONNECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingAccount" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "accountName" TEXT,
    "broker" TEXT,
    "server" TEXT,
    "accountLogin" TEXT NOT NULL,
    "environment" "AccountEnvironment" NOT NULL DEFAULT 'DEMO',
    "status" "TradingAccountStatus" NOT NULL DEFAULT 'INACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balance" DECIMAL(18,2),
    "equity" DECIMAL(18,2),
    "margin" DECIMAL(18,2),
    "freeMargin" DECIMAL(18,2),
    "leverage" INTEGER,
    "lastConnectedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotConfiguration" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tradingAccountId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "strategyType" "StrategyType" NOT NULL DEFAULT 'HYBRID',
    "tradingMode" "TradingMode" NOT NULL DEFAULT 'ALL_QUALIFYING',
    "symbols" TEXT[] DEFAULT ARRAY['EURUSD', 'GBPUSD', 'USDJPY']::TEXT[],
    "analysisTimeframe" TEXT NOT NULL DEFAULT 'M15',
    "entryTimeframe" TEXT NOT NULL DEFAULT 'M5',
    "riskPercentPerTrade" DECIMAL(5,2) NOT NULL DEFAULT 0.5,
    "maxOpenRiskPercent" DECIMAL(5,2) NOT NULL DEFAULT 2.0,
    "dailyLossLimitPercent" DECIMAL(5,2) NOT NULL DEFAULT 3.0,
    "maxConsecutiveLosses" INTEGER NOT NULL DEFAULT 3,
    "maxOpenTrades" INTEGER NOT NULL DEFAULT 3,
    "minRiskReward" DECIMAL(5,2) NOT NULL DEFAULT 2.0,
    "maxSpreadPoints" INTEGER NOT NULL DEFAULT 30,
    "stopAfterDailyLoss" BOOLEAN NOT NULL DEFAULT true,
    "useMarketStructure" BOOLEAN NOT NULL DEFAULT true,
    "useBOS" BOOLEAN NOT NULL DEFAULT true,
    "useCHOCH" BOOLEAN NOT NULL DEFAULT true,
    "useLiquiditySweeps" BOOLEAN NOT NULL DEFAULT true,
    "useOrderBlocks" BOOLEAN NOT NULL DEFAULT true,
    "useFVG" BOOLEAN NOT NULL DEFAULT true,
    "useIFVG" BOOLEAN NOT NULL DEFAULT true,
    "minConfluenceScore" INTEGER NOT NULL DEFAULT 70,
    "useEMAFilter" BOOLEAN NOT NULL DEFAULT true,
    "emaFastPeriod" INTEGER NOT NULL DEFAULT 50,
    "emaSlowPeriod" INTEGER NOT NULL DEFAULT 200,
    "useRSIFilter" BOOLEAN NOT NULL DEFAULT true,
    "rsiPeriod" INTEGER NOT NULL DEFAULT 14,
    "rsiBuyLevel" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "rsiSellLevel" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "useATRFilter" BOOLEAN NOT NULL DEFAULT true,
    "atrPeriod" INTEGER NOT NULL DEFAULT 14,
    "atrStopMultiplier" DECIMAL(6,2) NOT NULL DEFAULT 1.5,
    "allowBuy" BOOLEAN NOT NULL DEFAULT true,
    "allowSell" BOOLEAN NOT NULL DEFAULT true,
    "manageExistingTrades" BOOLEAN NOT NULL DEFAULT true,
    "autoTrading" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotInstance" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tradingAccountId" INTEGER NOT NULL,
    "configurationId" INTEGER NOT NULL,
    "name" TEXT,
    "status" "BotStatus" NOT NULL DEFAULT 'STOPPED',
    "instanceKey" TEXT NOT NULL,
    "terminalVersion" TEXT,
    "eaVersion" TEXT,
    "symbol" TEXT,
    "timeframe" TEXT,
    "ipAddress" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotEvent" (
    "id" SERIAL NOT NULL,
    "botInstanceId" INTEGER NOT NULL,
    "eventType" "BotEventType" NOT NULL,
    "message" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeSignal" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "configurationId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "signalType" "SignalType" NOT NULL DEFAULT 'COMBINED',
    "analysisTimeframe" TEXT NOT NULL DEFAULT 'M15',
    "entryTimeframe" TEXT NOT NULL DEFAULT 'M5',
    "entryPrice" DECIMAL(18,8),
    "stopLoss" DECIMAL(18,8),
    "takeProfit" DECIMAL(18,8),
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "metadata" JSONB,
    "status" "SignalStatus" NOT NULL DEFAULT 'NEW',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOrder" (
    "id" TEXT NOT NULL,
    "clientOrderId" TEXT NOT NULL,
    "brokerOrderId" TEXT,
    "symbol" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "volume" DECIMAL(18,8) NOT NULL,
    "requestedPrice" DECIMAL(18,8),
    "filledPrice" DECIMAL(18,8),
    "stopLoss" DECIMAL(18,8),
    "takeProfit" DECIMAL(18,8),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "errorMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "filledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "tradeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tradingAccountId" INTEGER NOT NULL,
    "configurationId" INTEGER NOT NULL,
    "signalId" INTEGER,
    "brokerPositionId" TEXT,
    "symbol" TEXT NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "volume" DECIMAL(18,8) NOT NULL,
    "entryPrice" DECIMAL(18,8) NOT NULL,
    "exitPrice" DECIMAL(18,8),
    "stopLoss" DECIMAL(18,8),
    "takeProfit" DECIMAL(18,8),
    "profit" DECIMAL(18,2),
    "commission" DECIMAL(18,2),
    "swap" DECIMAL(18,2),
    "netProfit" DECIMAL(18,2),
    "riskAmount" DECIMAL(18,2),
    "riskReward" DECIMAL(10,4),
    "exitReason" "ExitReason",
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "TradingAccount_userId_idx" ON "TradingAccount"("userId");

-- CreateIndex
CREATE INDEX "TradingAccount_status_idx" ON "TradingAccount"("status");

-- CreateIndex
CREATE INDEX "TradingAccount_environment_idx" ON "TradingAccount"("environment");

-- CreateIndex
CREATE UNIQUE INDEX "TradingAccount_userId_server_accountLogin_key" ON "TradingAccount"("userId", "server", "accountLogin");

-- CreateIndex
CREATE INDEX "BotConfiguration_userId_idx" ON "BotConfiguration"("userId");

-- CreateIndex
CREATE INDEX "BotConfiguration_tradingAccountId_idx" ON "BotConfiguration"("tradingAccountId");

-- CreateIndex
CREATE INDEX "BotConfiguration_enabled_idx" ON "BotConfiguration"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "BotInstance_instanceKey_key" ON "BotInstance"("instanceKey");

-- CreateIndex
CREATE INDEX "BotInstance_userId_idx" ON "BotInstance"("userId");

-- CreateIndex
CREATE INDEX "BotInstance_tradingAccountId_idx" ON "BotInstance"("tradingAccountId");

-- CreateIndex
CREATE INDEX "BotInstance_configurationId_idx" ON "BotInstance"("configurationId");

-- CreateIndex
CREATE INDEX "BotInstance_status_idx" ON "BotInstance"("status");

-- CreateIndex
CREATE INDEX "BotInstance_lastHeartbeatAt_idx" ON "BotInstance"("lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "BotEvent_botInstanceId_idx" ON "BotEvent"("botInstanceId");

-- CreateIndex
CREATE INDEX "BotEvent_eventType_idx" ON "BotEvent"("eventType");

-- CreateIndex
CREATE INDEX "BotEvent_createdAt_idx" ON "BotEvent"("createdAt");

-- CreateIndex
CREATE INDEX "TradeSignal_userId_idx" ON "TradeSignal"("userId");

-- CreateIndex
CREATE INDEX "TradeSignal_configurationId_idx" ON "TradeSignal"("configurationId");

-- CreateIndex
CREATE INDEX "TradeSignal_symbol_idx" ON "TradeSignal"("symbol");

-- CreateIndex
CREATE INDEX "TradeSignal_status_idx" ON "TradeSignal"("status");

-- CreateIndex
CREATE INDEX "TradeSignal_generatedAt_idx" ON "TradeSignal"("generatedAt");

-- CreateIndex
CREATE INDEX "TradeSignal_symbol_status_idx" ON "TradeSignal"("symbol", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOrder_clientOrderId_key" ON "TradeOrder"("clientOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOrder_tradeId_key" ON "TradeOrder"("tradeId");

-- CreateIndex
CREATE INDEX "TradeOrder_symbol_idx" ON "TradeOrder"("symbol");

-- CreateIndex
CREATE INDEX "TradeOrder_status_idx" ON "TradeOrder"("status");

-- CreateIndex
CREATE INDEX "TradeOrder_brokerOrderId_idx" ON "TradeOrder"("brokerOrderId");

-- CreateIndex
CREATE INDEX "TradeOrder_createdAt_idx" ON "TradeOrder"("createdAt");

-- CreateIndex
CREATE INDEX "Trade_userId_idx" ON "Trade"("userId");

-- CreateIndex
CREATE INDEX "Trade_tradingAccountId_idx" ON "Trade"("tradingAccountId");

-- CreateIndex
CREATE INDEX "Trade_configurationId_idx" ON "Trade"("configurationId");

-- CreateIndex
CREATE INDEX "Trade_signalId_idx" ON "Trade"("signalId");

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");

-- CreateIndex
CREATE INDEX "Trade_status_idx" ON "Trade"("status");

-- CreateIndex
CREATE INDEX "Trade_openedAt_idx" ON "Trade"("openedAt");

-- CreateIndex
CREATE INDEX "Trade_closedAt_idx" ON "Trade"("closedAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotConfiguration" ADD CONSTRAINT "BotConfiguration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotConfiguration" ADD CONSTRAINT "BotConfiguration_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotInstance" ADD CONSTRAINT "BotInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotInstance" ADD CONSTRAINT "BotInstance_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotInstance" ADD CONSTRAINT "BotInstance_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "BotConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotEvent" ADD CONSTRAINT "BotEvent_botInstanceId_fkey" FOREIGN KEY ("botInstanceId") REFERENCES "BotInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeSignal" ADD CONSTRAINT "TradeSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeSignal" ADD CONSTRAINT "TradeSignal_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "BotConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "BotConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "TradeSignal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
