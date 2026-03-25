// src/services/PartnerBalanceService.js  — VERSION ENRICHIE + TRANSACTION DIRECTE ADMIN
import prisma from '../config/database.js';

class PartnerBalanceService {

  convertFromInt(value) {
    return Number(value) / 100;
  }

  convertToInt(value) {
    return Math.round(parseFloat(value) * 100);
  }

  getActiveTransactionFilter(partenaireId) {
    return {
      partenaireId,
      type: { in: ['DEPOT', 'RETRAIT'] },
      OR: [{ archived: false }, { archived: null }],
      NOT: { description: { startsWith: '[SUPPRIMÉ]' } }
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // TRANSACTION DIRECTE ADMIN → PARTENAIRE
  // ❌ Pas de destinataireId superviseur → n'impacte AUCUNE card superviseur
  // ✅ Apparaît uniquement dans le solde/historique du partenaire
  // ─────────────────────────────────────────────────────────────────

  async createAdminDirectTransaction(adminId, partenaireId, type, montant) {
    const partner = await prisma.user.findUnique({
      where: { id: partenaireId, role: 'PARTENAIRE' },
      select: { id: true, nomComplet: true, status: true }
    });
    if (!partner) throw new Error('Partenaire introuvable');
    if (partner.status !== 'ACTIVE') throw new Error('Partenaire suspendu');

    const admin = await prisma.user.findUnique({
      where: { id: adminId, role: 'ADMIN' },
      select: { id: true, nomComplet: true }
    });
    if (!admin) throw new Error('Admin introuvable');

    const montantFloat = parseFloat(montant);
    if (isNaN(montantFloat) || montantFloat <= 0) throw new Error('Montant invalide');

    const montantInt  = this.convertToInt(montantFloat);
    const typeUpper   = type === 'depot' ? 'DEPOT' : 'RETRAIT';
    const description = typeUpper === 'DEPOT'
      ? `Dépôt direct admin — ${admin.nomComplet}`
      : `Retrait direct admin — ${admin.nomComplet}`;

    const transaction = await prisma.transaction.create({
      data: {
        montant:     montantInt,
        type:        typeUpper,
        description,
        envoyeurId:  adminId,
        partenaireId,
        // ← PAS de destinataireId : invisible pour tous les superviseurs
      },
      select: {
        id: true, type: true, montant: true,
        description: true, createdAt: true
      }
    });

    return {
      id:          transaction.id,
      type:        transaction.type,
      montant:     this.convertFromInt(transaction.montant),
      description: transaction.description,
      createdAt:   transaction.createdAt,
      partenaire:  partner.nomComplet,
      admin:       admin.nomComplet,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SOLDE SIMPLE
  // ─────────────────────────────────────────────────────────────────

  async getPartnerBalance(partenaireId) {
    const partner = await prisma.user.findUnique({
      where: { id: partenaireId, role: 'PARTENAIRE' },
      select: { id: true, nomComplet: true, telephone: true, status: true, createdAt: true }
    });
    if (!partner) throw new Error('Partenaire introuvable');

    const transactions = await prisma.transaction.findMany({
      where: this.getActiveTransactionFilter(partenaireId),
      select: {
        id: true, type: true, montant: true, createdAt: true, archived: true,
        destinataire: { select: { id: true, nomComplet: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    let totalDepots = 0, totalRetraits = 0;
    transactions.forEach(tx => {
      const m = this.convertFromInt(tx.montant);
      if (tx.type === 'DEPOT')   totalDepots   += m;
      if (tx.type === 'RETRAIT') totalRetraits += m;
    });

    const solde = totalDepots - totalRetraits;
    const etat  = solde > 0 ? 'BOUTIQUE_DOIT' : solde < 0 ? 'PARTENAIRE_DOIT' : 'SOLDE';

    return {
      partenaire: {
        id: partner.id, nomComplet: partner.nomComplet,
        telephone: partner.telephone, status: partner.status
      },
      solde: {
        montant: solde, montantAbsolu: Math.abs(solde), etat,
        label: etat === 'BOUTIQUE_DOIT'
          ? `Boutique doit ${Math.abs(solde).toLocaleString('fr-FR')} F`
          : etat === 'PARTENAIRE_DOIT'
            ? `Partenaire doit ${Math.abs(solde).toLocaleString('fr-FR')} F`
            : 'Soldé ✅'
      },
      statistiques: {
        totalDepots, totalRetraits,
        nombreTransactions: transactions.length,
        derniereTransaction: transactions[0]?.createdAt ?? null
      },
      transactions: transactions.map(tx => ({
        id: tx.id, type: tx.type, montant: this.convertFromInt(tx.montant),
        createdAt: tx.createdAt, archived: tx.archived ?? false,
        superviseur: tx.destinataire?.nomComplet ?? null
      }))
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HISTORIQUE ENRICHI
  // ─────────────────────────────────────────────────────────────────

  async getPartnerHistory(partenaireId) {
    try {
      const partner = await prisma.user.findUnique({
        where: { id: partenaireId, role: 'PARTENAIRE' },
        select: { id: true, nomComplet: true, telephone: true, status: true, createdAt: true }
      });
      if (!partner) throw new Error('Partenaire introuvable');

      const transactions = await prisma.transaction.findMany({
        where: this.getActiveTransactionFilter(partenaireId),
        select: {
          id:          true,
          type:        true,
          montant:     true,
          createdAt:   true,
          archived:    true,
          description: true,
          envoyeur: {
            select: {
              id:         true,
              nomComplet: true,
              role:       true,
              status:     true,
            }
          },
        },
        orderBy: { createdAt: 'desc' }
      });

      let totalDepots = 0, totalRetraits = 0;
      let plusGrosDepot = 0, plusGrosRetrait = 0;
      const montants = [];

      transactions.forEach(tx => {
        const m = this.convertFromInt(tx.montant);
        montants.push(m);
        if (tx.type === 'DEPOT') {
          totalDepots += m;
          if (m > plusGrosDepot) plusGrosDepot = m;
        } else {
          totalRetraits += m;
          if (m > plusGrosRetrait) plusGrosRetrait = m;
        }
      });

      const solde   = totalDepots - totalRetraits;
      const etat    = solde > 0 ? 'BOUTIQUE_DOIT' : solde < 0 ? 'PARTENAIRE_DOIT' : 'SOLDE';
      const moyenne = montants.length > 0
        ? montants.reduce((a, b) => a + b, 0) / montants.length
        : 0;

      const sorted   = [...transactions].sort((a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt));
      const derniere = transactions[0]?.createdAt ?? null;
      const premiere = sorted[0]?.createdAt      ?? null;

      const txFormatted = transactions.map(tx => {
        const m   = this.convertFromInt(tx.montant);
        const emp = tx.envoyeur ?? null;

        let employeStatus = 'ACTIVE';
        if (!emp)                            employeStatus = 'DELETED';
        else if (emp.status === 'SUSPENDED') employeStatus = 'SUSPENDED';

        return {
          id:        tx.id,
          type:      tx.type,
          montant:   m,
          createdAt: tx.createdAt,
          archived:  tx.archived ?? false,
          note:      tx.description ?? null,
          reference: null,
          // Si envoyeur est ADMIN → transaction directe admin
          isAdminDirect: emp?.role === 'ADMIN',
          superviseur: emp ? {
            id:         emp.id,
            nomComplet: emp.nomComplet,
            role:       emp.role,
            status:     employeStatus,
          } : null,
        };
      });

      return {
        partenaire: {
          id:         partner.id,
          nomComplet: partner.nomComplet,
          telephone:  partner.telephone,
          status:     partner.status,
          createdAt:  partner.createdAt,
        },
        solde: {
          montant:       solde,
          montantAbsolu: Math.abs(solde),
          etat,
          label: etat === 'BOUTIQUE_DOIT'
            ? `Boutique doit ${Math.abs(solde).toLocaleString('fr-FR')} F`
            : etat === 'PARTENAIRE_DOIT'
              ? `Partenaire doit ${Math.abs(solde).toLocaleString('fr-FR')} F`
              : 'Soldé ✅'
        },
        statistiques: {
          totalDepots,
          totalRetraits,
          nombreTransactions:  transactions.length,
          derniereTransaction: derniere,
          premiereTransaction: premiere,
          moyenneTransaction:  Math.round(moyenne),
          plusGrosDepot,
          plusGrosRetrait,
        },
        transactions: txFormatted,
      };

    } catch (error) {
      console.error('❌ [PARTNER HISTORY] getPartnerHistory:', error.message);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // SOLDES DE TOUS LES PARTENAIRES
  // ─────────────────────────────────────────────────────────────────

  async getAllPartnersBalances() {
    try {
      const partners = await prisma.user.findMany({
        where: { role: 'PARTENAIRE' },
        select: { id: true, nomComplet: true, telephone: true, status: true },
        orderBy: { nomComplet: 'asc' }
      });

      const allTransactions = await prisma.transaction.findMany({
        where: {
          partenaireId: { in: partners.map(p => p.id) },
          type: { in: ['DEPOT', 'RETRAIT'] },
          OR: [{ archived: false }, { archived: null }],
          NOT: { description: { startsWith: '[SUPPRIMÉ]' } }
        },
        select: { partenaireId: true, type: true, montant: true, createdAt: true }
      });

      const txByPartner = {};
      allTransactions.forEach(tx => {
        if (!txByPartner[tx.partenaireId])
          txByPartner[tx.partenaireId] = { depots: 0, retraits: 0, count: 0, derniere: null };
        const m = this.convertFromInt(tx.montant);
        if (tx.type === 'DEPOT')   txByPartner[tx.partenaireId].depots   += m;
        if (tx.type === 'RETRAIT') txByPartner[tx.partenaireId].retraits += m;
        txByPartner[tx.partenaireId].count++;
        if (!txByPartner[tx.partenaireId].derniere || tx.createdAt > txByPartner[tx.partenaireId].derniere)
          txByPartner[tx.partenaireId].derniere = tx.createdAt;
      });

      return partners.map(partner => {
        const data  = txByPartner[partner.id] ?? { depots: 0, retraits: 0, count: 0, derniere: null };
        const solde = data.depots - data.retraits;
        const etat  = solde > 0 ? 'BOUTIQUE_DOIT' : solde < 0 ? 'PARTENAIRE_DOIT' : 'SOLDE';
        return {
          id: partner.id, nomComplet: partner.nomComplet,
          telephone: partner.telephone, status: partner.status,
          solde: {
            montant: solde, montantAbsolu: Math.abs(solde), etat,
            label: etat === 'BOUTIQUE_DOIT'
              ? `Boutique doit ${Math.abs(solde).toLocaleString('fr-FR')} F`
              : etat === 'PARTENAIRE_DOIT'
                ? `Partenaire doit ${Math.abs(solde).toLocaleString('fr-FR')} F`
                : 'Soldé ✅'
          },
          statistiques: {
            totalDepots: data.depots, totalRetraits: data.retraits,
            nombreTransactions: data.count, derniereTransaction: data.derniere
          }
        };
      });
    } catch (error) {
      console.error('❌ [PARTNER BALANCE] getAllPartnersBalances:', error.message);
      throw error;
    }
  }
}

export default new PartnerBalanceService();