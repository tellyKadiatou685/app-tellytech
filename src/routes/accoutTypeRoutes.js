// src/routes/accountTypeRoutes.js
import express from 'express';
import AccountTypeService from '../services/AccountTypeService.js';
// Décommentez quand le middleware auth est prêt :
// import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// router.use(authenticateToken);
// router.use(requireAdmin);

// ─── Helper : récupère l'adminId sans planter si req.user absent ──────────────
// ✅ FIX : req.user?.userId peut être undefined → on passe null
//          AccountTypeService.createAuditLog() ignore gracieusement null
const getAdminId = (req) => req.user?.userId ?? req.body?.adminId ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/accountype
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const config = await AccountTypeService.getAccountTypesConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('GET /accountype erreur:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/accountype/AUTRES/label
// ⚠️ DOIT rester AVANT /:type/toggle
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/AUTRES/label', async (req, res) => {
  try {
    const { label } = req.body;

    if (!label) {
      return res.status(400).json({ success: false, message: 'Le champ label est requis' });
    }

    const result = await AccountTypeService.updateAutresLabel(getAdminId(req), label);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('PATCH /accountype/AUTRES/label erreur:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/accountype/:type/toggle
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:type/toggle', async (req, res) => {
  try {
    const accountType = req.params.type.toUpperCase();
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive doit être un booléen (true ou false)'
      });
    }

    const result = await AccountTypeService.toggleAccountType(
      getAdminId(req),   // ✅ null si pas de req.user → audit ignoré proprement
      accountType,
      isActive
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('PATCH /accountype/:type/toggle erreur:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/accountype
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { types, autresLabel } = req.body;

    if (!Array.isArray(types)) {
      return res.status(400).json({ success: false, message: 'types doit être un tableau' });
    }

    const result = await AccountTypeService.setActiveAccountTypes(
      getAdminId(req),
      types,
      autresLabel
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('POST /accountype erreur:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;