// src/controllers/PartnerBalanceController.js
import PartnerBalanceService from '../services/PartnerBalanceService.js';

class PartnerBalanceController {

  // GET /api/partner-balance
  async getAllPartnersBalances(req, res) {
    try {
      const results = await PartnerBalanceService.getAllPartnersBalances();
      res.json({
        success: true,
        message: `${results.length} solde(s) partenaires récupérés`,
        data: { partners: results }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /api/partner-balance/:partenaireId
  async getPartnerBalance(req, res) {
    try {
      const { partenaireId } = req.params;
      if (!partenaireId)
        return res.status(400).json({ success: false, message: 'ID partenaire requis' });

      const result = await PartnerBalanceService.getPartnerBalance(partenaireId);
      res.json({
        success: true,
        message: `Solde de ${result.partenaire.nomComplet} récupéré`,
        data: result
      });
    } catch (error) {
      const status = error.message.includes('introuvable') ? 404 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  // GET /api/partner-balance/:partenaireId/history
  async getPartnerHistory(req, res) {
    try {
      const { partenaireId } = req.params;
      if (!partenaireId)
        return res.status(400).json({ success: false, message: 'ID partenaire requis' });

      const result = await PartnerBalanceService.getPartnerHistory(partenaireId);
      res.json({
        success: true,
        message: `Historique de ${result.partenaire.nomComplet} récupéré`,
        data: result
      });
    } catch (error) {
      const status = error.message.includes('introuvable') ? 404 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  // POST /api/partner-balance/:partenaireId/transaction
  // ✅ Sans destinataireId → n'impacte AUCUN superviseur
  // ✅ Body: { type: 'depot' | 'retrait', montant: number }
  async createAdminDirectTransaction(req, res) {
    try {
      const { partenaireId } = req.params;
      const { type, montant } = req.body;
      const adminId = req.user?.id;

      if (!partenaireId)
        return res.status(400).json({ success: false, message: 'ID partenaire requis' });

      if (!adminId)
        return res.status(401).json({ success: false, message: 'Non authentifié' });

      if (!type || !['depot', 'retrait'].includes(type))
        return res.status(400).json({
          success: false,
          message: "Type invalide — valeurs acceptées : 'depot' ou 'retrait'"
        });

      const montantFloat = parseFloat(montant);
      if (!montant || isNaN(montantFloat) || montantFloat <= 0)
        return res.status(400).json({
          success: false,
          message: 'Montant invalide — doit être un nombre positif'
        });

      const result = await PartnerBalanceService.createAdminDirectTransaction(
        adminId,
        partenaireId,
        type,
        montantFloat
      );

      res.status(201).json({
        success: true,
        message: `${type === 'depot' ? 'Dépôt' : 'Retrait'} de ${montantFloat.toLocaleString('fr-FR')} F effectué pour ${result.partenaire}`,
        data: result
      });

    } catch (error) {
      const status =
        error.message.includes('introuvable') ? 404 :
        error.message.includes('suspendu')    ? 403 :
        error.message.includes('invalide')    ? 400 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}

export default new PartnerBalanceController();