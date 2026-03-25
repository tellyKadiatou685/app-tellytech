// src/routes/partnerBalanceRoutes.js
import express from 'express';
import PartnerBalanceController from '../controllers/PartnerBalanceController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js'; // ← adapte selon ton middleware

const router = express.Router();

// ─── Toutes les routes nécessitent d'être authentifié ───────────────
router.use(authenticateToken);

// GET  /api/partner-balance
// → Liste tous les partenaires avec leur solde actuel
router.get(
  '/',
  PartnerBalanceController.getAllPartnersBalances.bind(PartnerBalanceController)
);

// GET  /api/partner-balance/:partenaireId
// → Solde + transactions d'un partenaire
router.get(
  '/:partenaireId',
  PartnerBalanceController.getPartnerBalance.bind(PartnerBalanceController)
);

// GET  /api/partner-balance/:partenaireId/history
// → Historique enrichi (stats avancées, statut employé, etc.)
router.get(
  '/:partenaireId/history',
  PartnerBalanceController.getPartnerHistory.bind(PartnerBalanceController)
);

// POST /api/partner-balance/:partenaireId/transaction
// → Transaction directe ADMIN → PARTENAIRE (sans impacter les superviseurs)
// → Réservé aux admins uniquement
router.post(
  '/:partenaireId/transaction',
  requireAdmin,
  PartnerBalanceController.createAdminDirectTransaction.bind(PartnerBalanceController)
);

export default router;