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

  // GET /api/partner-balance/:partenaireId/history  ← NOUVEAU
  //
  // Retourne l'historique complet enrichi :
  //   - Chaque transaction avec l'employé qui l'a faite
  //   - Statut de l'employé (ACTIVE / SUSPENDED / DELETED)
  //   - Note, référence, heure exacte
  //   - Statistiques avancées (moyenne, plus gros dépôt/retrait, etc.)
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
}

export default new PartnerBalanceController();