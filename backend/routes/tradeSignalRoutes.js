import express from "express";

import {
    createTradeSignal,
    getTradeSignals,
    getTradeSignalById,
    updateTradeSignal,
    processTradeSignal,
    deleteTradeSignal,
} from "../controllers/tradeSignalController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Require authentication for every endpoint
router.use(protect);

router.post("/", createTradeSignal);
router.get("/", getTradeSignals);
router.get("/:id", getTradeSignalById);
router.patch("/:id/process", processTradeSignal);
router.patch("/:id", updateTradeSignal);
router.delete("/:id", deleteTradeSignal);

export default router;