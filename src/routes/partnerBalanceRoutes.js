import express from 'express';
import PartnerBalanceController from '../controllers/PartnerBalanceController.js';
import { authenticateToken, requireSupervisorOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/partner-balance
router.get(
  '/',
  authenticateToken,
  requireSupervisorOrAdmin,
  PartnerBalanceController.getAllPartnersBalances
);

// GET /api/partner-balance/:partenaireId
router.get(
  '/:partenaireId',
  authenticateToken,
  requireSupervisorOrAdmin,
  PartnerBalanceController.getPartnerBalance
);

// GET /api/partner-balance/:partenaireId/history  ← NOUVEAU
router.get(
  '/:partenaireId/history',
  authenticateToken,
  requireSupervisorOrAdmin,
  PartnerBalanceController.getPartnerHistory
);

export default router;
