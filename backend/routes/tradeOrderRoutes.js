import express from "express";

import {
    createTradeOrder,
    getTradeOrders,
    getTradeOrderById,
    cancelTradeOrder,
} from "../controllers/tradeOrderController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createTradeOrder);
router.get("/", getTradeOrders);
router.get("/:id", getTradeOrderById);
router.patch("/:id/cancel", cancelTradeOrder);

export default router;