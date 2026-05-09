export const ROLES = {
    SUPER_ADMIN_BOUTIQUE: 'super_admin_boutique',
    VENDEUR: 'vendeur',
    STOCK_MANAGER: 'stock_manager',
    COMPTABLE: 'comptable',
} as const

export const ROLES_PLATEFORME = {
    SUPER_PLATFORM_ADMIN: 'super_platform_admin',
    PLATFORM_AGENT: 'platform_agent',
} as const

export type RoleBoutique = typeof ROLES[keyof typeof ROLES]
export type RolePlateforme = typeof ROLES_PLATEFORME[keyof typeof ROLES_PLATEFORME]

export const PERMISSIONS = {
    // Produits
    PRODUITS_VOIR: 'products.view',
    PRODUITS_CREER: 'products.create',
    PRODUITS_MODIFIER: 'products.edit',
    PRODUITS_DESACTIVER: 'products.deactivate',
    PRODUITS_PRIX_MODIFIER: 'products.price.edit',
    // Stock
    STOCK_VOIR: 'stock.view',
    STOCK_TRANSFERT: 'stock.transfer',
    STOCK_AJUSTEMENT: 'stock.adjust',
    STOCK_INVENTAIRE_CREER: 'stock.audit.create',
    STOCK_INVENTAIRE_VALIDER: 'stock.audit.validate',
    // Ventes
    VENTES_CREER: 'sales.create',
    VENTES_VOIR: 'sales.view',
    VENTES_RETOUR: 'sales.return',
    VENTES_REMISE: 'sales.discount',
    // Facturation
    FACTURES_CREER: 'invoices.create',
    FACTURES_VOIR: 'invoices.view',
    FACTURES_PAIEMENT: 'invoices.payment',
    AVOIRS_CREER: 'credit_notes.create',
    // Fournisseurs
    FOURNISSEURS_VOIR: 'suppliers.view',
    FOURNISSEURS_CREER: 'suppliers.create',
    FOURNISSEURS_MODIFIER: 'suppliers.edit',
    BONS_COMMANDE_CREER: 'purchase_orders.create',
    RECEPTION_CREER: 'reception.create',
    PAIEMENT_FOURNISSEUR: 'supplier_payment.declare',
    // Clients
    CLIENTS_VOIR: 'clients.view',
    CLIENTS_CREER: 'clients.create',
    CLIENTS_ACCES_COMPLET: 'clients.full_access',
    // Comptabilité
    COMPTABILITE_VOIR: 'accounting.view',
    DEPENSES_CREER: 'expenses.create',
    SALAIRES_GERER: 'salaries.manage',
    RAPPORTS_GENERER: 'reports.generate',
    RAPPORTS_TOUS: 'reports.all',
    // Administration
    UTILISATEURS_GERER: 'users.manage',
    PARAMETRES_GERER: 'settings.manage',
    AUDIT_VOIR: 'audit.view',
    SAUVEGARDE_GERER: 'backup.manage',
} as const

export const PERMISSIONS_PAR_DEFAUT: Record<RoleBoutique, string[]> = {
    super_admin_boutique: [], // a tout — vérifié séparément
    vendeur: [
        PERMISSIONS.PRODUITS_VOIR,
        PERMISSIONS.STOCK_VOIR,
        PERMISSIONS.VENTES_CREER,
        PERMISSIONS.VENTES_VOIR,
        PERMISSIONS.VENTES_RETOUR,
        PERMISSIONS.VENTES_REMISE,
        PERMISSIONS.FACTURES_CREER,
        PERMISSIONS.FACTURES_VOIR,
        PERMISSIONS.CLIENTS_VOIR,
        PERMISSIONS.CLIENTS_CREER,
    ],
    stock_manager: [
        PERMISSIONS.PRODUITS_VOIR,
        PERMISSIONS.PRODUITS_CREER,
        PERMISSIONS.PRODUITS_MODIFIER,
        PERMISSIONS.STOCK_VOIR,
        PERMISSIONS.STOCK_TRANSFERT,
        PERMISSIONS.STOCK_AJUSTEMENT,
        PERMISSIONS.STOCK_INVENTAIRE_CREER,
        PERMISSIONS.STOCK_INVENTAIRE_VALIDER,
        PERMISSIONS.FOURNISSEURS_VOIR,
        PERMISSIONS.FOURNISSEURS_CREER,
        PERMISSIONS.FOURNISSEURS_MODIFIER,
        PERMISSIONS.BONS_COMMANDE_CREER,
        PERMISSIONS.RECEPTION_CREER,
    ],
    comptable: [
        PERMISSIONS.PRODUITS_VOIR,
        PERMISSIONS.PRODUITS_PRIX_MODIFIER,
        PERMISSIONS.STOCK_VOIR,
        PERMISSIONS.VENTES_VOIR,
        PERMISSIONS.FACTURES_VOIR,
        PERMISSIONS.FACTURES_CREER,
        PERMISSIONS.FACTURES_PAIEMENT,
        PERMISSIONS.FOURNISSEURS_VOIR,
        PERMISSIONS.PAIEMENT_FOURNISSEUR,
        PERMISSIONS.CLIENTS_VOIR,
        PERMISSIONS.CLIENTS_ACCES_COMPLET,
        PERMISSIONS.COMPTABILITE_VOIR,
        PERMISSIONS.DEPENSES_CREER,
        PERMISSIONS.SALAIRES_GERER,
        PERMISSIONS.RAPPORTS_GENERER,
        PERMISSIONS.RAPPORTS_TOUS,
    ],
}

export const EXTENSIONS_VENDEUR: string[] = [
    PERMISSIONS.FOURNISSEURS_CREER,
    PERMISSIONS.RAPPORTS_GENERER,
    PERMISSIONS.CLIENTS_ACCES_COMPLET,
]