
import express from "express";

import {
    createBotConfiguration,
    getBotConfigurations,
    getBotConfigurationById,
    updateBotConfiguration,
    enableBotConfiguration,
    disableBotConfiguration,
    deleteBotConfiguration,
} from "../controllers/botConfigurationController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Require authentication for every endpoint.
router.use(protect);

// Create a bot configuration.
router.post("/", createBotConfiguration);

// List the logged-in user's configurations.
router.get("/", getBotConfigurations);

// Get a single configuration.
router.get("/:id", getBotConfigurationById);

// Update settings.
router.patch("/:id", updateBotConfiguration);

// Enable a configuration.
router.patch("/:id/enable", enableBotConfiguration);

// Disable a configuration.
router.patch("/:id/disable", disableBotConfiguration);

// Delete a configuration.
router.delete("/:id", deleteBotConfiguration);

export default router;

