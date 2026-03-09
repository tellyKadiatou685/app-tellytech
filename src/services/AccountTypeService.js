// src/services/AccountTypeService.js
import prisma from '../config/database.js';

const ALL_ACCOUNT_TYPES = [
  'LIQUIDE', 'ORANGE_MONEY', 'WAVE', 'UV_MASTER',
  'FREE_MONEY', 'WESTERN_UNION', 'RIA', 'MONEYGRAM', 'AUTRES'
];

const ACCOUNT_TYPE_LABELS = {
  LIQUIDE:       'Liquide',
  ORANGE_MONEY:  'Orange Money',
  WAVE:          'Wave',
  UV_MASTER:     'UV Master',
  FREE_MONEY:    'Free Money',
  WESTERN_UNION: 'Western Union',
  RIA:           'Ria',
  MONEYGRAM:     'MoneyGram',
  AUTRES:        'Autres'
};

const DEFAULT_ACTIVE_TYPES = ['LIQUIDE', 'ORANGE_MONEY', 'WAVE', 'UV_MASTER'];

// ─── HELPER : audit uniquement si adminId valide ──────────────────────────────
// ✅ FIX : envoyeurId: undefined → Prisma plante car envoyeur est requis
// Solution : ne créer l'audit que si on a un vrai ID utilisateur
async function createAuditLog(adminId, description) {
  if (!adminId || typeof adminId !== 'string' || adminId.trim() === '') {
    console.warn(`⚠️  [AUDIT] Ignoré — adminId manquant: "${adminId}"`);
    return;
  }
  try {
    await prisma.transaction.create({
      data: {
        montant:     0,
        type:        'AUDIT_MODIFICATION',
        description,
        envoyeurId:  adminId,
      }
    });
  } catch (err) {
    // Ne jamais bloquer l'action principale à cause de l'audit
    console.error('⚠️  [AUDIT] Échec de l\'enregistrement:', err.message);
  }
}

class AccountTypeService {

  // ─── LECTURE ───────────────────────────────────────────────────────────────

  async getAccountTypesConfig() {
    try {
      const [typesConfig, autresLabelConfig] = await Promise.all([
        prisma.systemConfig.findFirst({ where: { key: 'active_account_types' } }),
        prisma.systemConfig.findFirst({ where: { key: 'autres_label' } })
      ]);

      const activeTypes  = typesConfig ? JSON.parse(typesConfig.value) : DEFAULT_ACTIVE_TYPES;
      const autresLabel  = autresLabelConfig?.value || 'Autres';

      const allTypes = ALL_ACCOUNT_TYPES.map(type => ({
        value:              type,
        label:              type === 'AUTRES' ? autresLabel : ACCOUNT_TYPE_LABELS[type],
        isActive:           activeTypes.includes(type),
        canCustomizeLabel:  type === 'AUTRES'
      }));

      const activeOptions = allTypes
        .filter(t => t.isActive)
        .map(t => ({ value: t.value, label: t.label }));

      return { allTypes, activeTypes, activeOptions, autresLabel };

    } catch (error) {
      console.error('❌ [ACCOUNT TYPE] getAccountTypesConfig:', error);
      const fallback = DEFAULT_ACTIVE_TYPES.map(t => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }));
      return {
        allTypes: ALL_ACCOUNT_TYPES.map(t => ({
          value: t, label: ACCOUNT_TYPE_LABELS[t],
          isActive: DEFAULT_ACTIVE_TYPES.includes(t), canCustomizeLabel: t === 'AUTRES'
        })),
        activeTypes:    DEFAULT_ACTIVE_TYPES,
        activeOptions:  fallback,
        autresLabel:    'Autres'
      };
    }
  }

  async isTypeActive(accountType) {
    try {
      const { activeTypes } = await this.getAccountTypesConfig();
      return activeTypes.includes(accountType);
    } catch {
      return DEFAULT_ACTIVE_TYPES.includes(accountType);
    }
  }

  async getTypeLabel(accountType) {
    if (accountType !== 'AUTRES') return ACCOUNT_TYPE_LABELS[accountType] || accountType;
    try {
      const config = await prisma.systemConfig.findFirst({ where: { key: 'autres_label' } });
      return config?.value || 'Autres';
    } catch {
      return 'Autres';
    }
  }

  // ─── TOGGLE ────────────────────────────────────────────────────────────────

  async toggleAccountType(adminId, accountType, isActive) {
    if (!ALL_ACCOUNT_TYPES.includes(accountType)) {
      throw new Error(`Type de compte invalide: ${accountType}`);
    }

    const { activeTypes } = await this.getAccountTypesConfig();

    let newTypes;
    if (isActive) {
      newTypes = activeTypes.includes(accountType)
        ? activeTypes
        : [...activeTypes, accountType];
    } else {
      newTypes = activeTypes.filter(t => t !== accountType);
      if (newTypes.length === 0) {
        throw new Error('Impossible de désactiver tous les types — au moins un doit rester actif');
      }
    }

    await prisma.systemConfig.upsert({
      where:  { key: 'active_account_types' },
      update: { value: JSON.stringify(newTypes) },
      create: { key: 'active_account_types', value: JSON.stringify(newTypes) }
    });

    // ✅ FIX : audit seulement si adminId valide
    await createAuditLog(
      adminId,
      `Type de compte "${accountType}" ${isActive ? 'activé' : 'désactivé'} par admin`
    );

    console.log(`✅ [ACCOUNT TYPE] ${accountType} → ${isActive ? 'ACTIF' : 'INACTIF'}`);

    return { success: true, accountType, isActive, activeTypes: newTypes };
  }

  // ─── LABEL AUTRES ──────────────────────────────────────────────────────────

  async updateAutresLabel(adminId, newLabel) {
    const label = newLabel?.trim();

    if (!label || label.length < 2)  throw new Error('Le nom doit contenir au moins 2 caractères');
    if (label.length > 50)           throw new Error('Le nom ne peut pas dépasser 50 caractères');

    await prisma.systemConfig.upsert({
      where:  { key: 'autres_label' },
      update: { value: label },
      create: { key: 'autres_label', value: label }
    });

    // ✅ FIX : audit seulement si adminId valide
    await createAuditLog(adminId, `Nom personnalisé "Autres" mis à jour: "${label}"`);

    console.log(`✅ [ACCOUNT TYPE] Label AUTRES → "${label}"`);

    return { success: true, autresLabel: label };
  }

  // ─── SET ALL ───────────────────────────────────────────────────────────────

  async setActiveAccountTypes(adminId, types, autresLabel = null) {
    const invalid = types.filter(t => !ALL_ACCOUNT_TYPES.includes(t));
    if (invalid.length > 0) throw new Error(`Types invalides: ${invalid.join(', ')}`);
    if (types.length === 0) throw new Error('Au moins un type de compte doit être actif');

    const ops = [
      prisma.systemConfig.upsert({
        where:  { key: 'active_account_types' },
        update: { value: JSON.stringify(types) },
        create: { key: 'active_account_types', value: JSON.stringify(types) }
      })
    ];

    if (types.includes('AUTRES') && autresLabel?.trim()) {
      ops.push(prisma.systemConfig.upsert({
        where:  { key: 'autres_label' },
        update: { value: autresLabel.trim() },
        create: { key: 'autres_label', value: autresLabel.trim() }
      }));
    }

    await prisma.$transaction(ops);

    // ✅ FIX : audit seulement si adminId valide
    await createAuditLog(
      adminId,
      `Types reconfigurés: [${types.join(', ')}]${autresLabel ? ` | Autres="${autresLabel}"` : ''}`
    );

    console.log(`✅ [ACCOUNT TYPE] Config complète: ${types.join(', ')}`);

    return { success: true, activeTypes: types, autresLabel: autresLabel || 'Autres' };
  }

  // ─── UTILS STATIQUES ───────────────────────────────────────────────────────

  getStaticLabel(type) { return ACCOUNT_TYPE_LABELS[type] || type; }
  getAllPossibleTypes() { return ALL_ACCOUNT_TYPES; }
}

export default new AccountTypeService();