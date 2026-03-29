// src/routes/partnerBalanceRoutes.js
import express from 'express';
import PartnerBalanceController from '../controllers/PartnerBalanceController.js';
import { authenticateToken, requireAdmin, requireAdminOrSupervisor } from '../middleware/auth.js';

const router = express.Router();

// ─── Toutes les routes nécessitent d'être authentifié ───────────────
router.use(authenticateToken);

// ─────────────────────────────────────────────────────────────────
// ROUTES PARTENAIRES
// ─────────────────────────────────────────────────────────────────

// GET /api/partner-balance
// → Liste tous les partenaires avec leur solde actuel
router.get(
  '/',
  PartnerBalanceController.getAllPartnersBalances.bind(PartnerBalanceController)
);

// GET /api/partner-balance/:partenaireId
// → Solde + transactions d'un partenaire
router.get(
  '/:partenaireId',
  PartnerBalanceController.getPartnerBalance.bind(PartnerBalanceController)
);

// GET /api/partner-balance/:partenaireId/history
// → Historique enrichi avec filtres optionnels
//
// Query params :
//   ?type=DEPOT|RETRAIT
//   ?dateDebut=YYYY-MM-DD
//   ?dateFin=YYYY-MM-DD
router.get(
  '/:partenaireId/history',
  PartnerBalanceController.getPartnerHistory.bind(PartnerBalanceController)
);

// POST /api/partner-balance/:partenaireId/transaction
// → Transaction directe ADMIN → PARTENAIRE (sans impacter les superviseurs)
// → Body : { type: 'depot'|'retrait', montant: number, commentaire?: string }
router.post(
  '/:partenaireId/transaction',
  requireAdmin,
  PartnerBalanceController.createAdminDirectTransaction.bind(PartnerBalanceController)
);

// ─────────────────────────────────────────────────────────────────
// ROUTES MODIFICATION / SUPPRESSION DE TRANSACTION
// ─────────────────────────────────────────────────────────────────

// PATCH /api/partner-balance/transaction/:transactionId/montant
// → Modifie le montant d'une transaction existante
// → Body : { montant: number }
// → ADMIN ou SUPERVISEUR propriétaire
router.patch(
  '/transaction/:transactionId/montant',
  requireAdminOrSupervisor,
  PartnerBalanceController.updateTransactionMontant.bind(PartnerBalanceController)
);

// DELETE /api/partner-balance/transaction/:transactionId
// → Suppression logique [SUPPRIMÉ]
// → Impact card superviseur si superviseur impliqué, sinon silencieux
// → ADMIN ou SUPERVISEUR propriétaire
router.delete(
  '/transaction/:transactionId',
  requireAdminOrSupervisor,
  PartnerBalanceController.deleteTransaction.bind(PartnerBalanceController)
);

export default router;