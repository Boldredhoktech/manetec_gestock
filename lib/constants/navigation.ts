// lib/constants/navigation.ts
// ═══════════════════════════════════════════════════════════════
// Le menu de la boutique, écrit UNE fois.
//
// Avant, il en existait trois — SidebarAdmin, SidebarStock,
// SidebarCompta — et c'est l'URL qui décidait lequel s'affichait.
// Passer de « Fournisseurs » à « Dépenses » faisait donc disparaître
// la moitié du menu sous les doigts : on cliquait sur un lien de la
// section Stock, la sidebar Stock prenait la place, et les groupes
// Ventes et Comptabilité s'évanouissaient.
//
// Trois listes tenues à la main, cela veut aussi dire trois vérités :
//   · « Bons de commande », « Transferts », « Ajustements » et
//     « Retours » n'existaient QUE dans la sidebar Stock — un
//     administrateur ne les voyait nulle part.
//   · « Caisse » n'existait QUE dans la sidebar Comptabilité.
//   · Les sidebars Stock et Comptabilité ignoraient le rôle ET le
//     plan : elles proposaient « Rapports » à une boutique Starter,
//     dont la route répond 403.
//
// Ici, une seule carte. Chaque entrée dit de quelle PERMISSION elle
// dépend — la même que la page vérifie côté serveur — et, s'il y a
// lieu, de quelle fonctionnalité du plan.
// ═══════════════════════════════════════════════════════════════

import {
    LayoutDashboard, Users, Settings, UserSquare, ShoppingCart,
    Package, FileText, Warehouse, Tags, Award, BarChart3, Receipt,
    ClipboardCheck, Send, Truck, CreditCard, PackageCheck, FileInput,
    ArrowLeftRight, SlidersHorizontal, Undo2, ClipboardList, Wallet,
} from 'lucide-react'
import { PERMISSIONS } from '@/lib/constants/permissions'

export interface LienNavigation {
    label:   string
    href:    string
    icone:   React.ElementType
    /** Permission exigée pour voir le lien. Absente = visible par tous. */
    permission?: string
    /** Fonctionnalité du plan dont dépend le lien. */
    plan?:   'rapports' | 'communications'
    /** Le POS s'ouvre dans un onglet à part : c'est un poste de travail. */
    nouvelOnglet?: boolean
}

export interface GroupeNavigation {
    groupe: string
    items:  LienNavigation[]
}

export const NAVIGATION_BOUTIQUE: GroupeNavigation[] = [
    {
        groupe: 'Général',
        items: [
            { label: 'Tableau de bord', href: '/admin/dashboard',    icone: LayoutDashboard },
            { label: 'Clients',         href: '/admin/clients',      icone: UserSquare,
              permission: PERMISSIONS.CLIENTS_VOIR },
            { label: 'Utilisateurs',    href: '/admin/utilisateurs', icone: Users,
              permission: PERMISSIONS.UTILISATEURS_GERER },
            { label: 'Paramètres',      href: '/admin/parametres',   icone: Settings,
              permission: PERMISSIONS.PARAMETRES_GERER },
            { label: 'Abonnement',      href: '/admin/abonnement',   icone: CreditCard,
              permission: PERMISSIONS.PARAMETRES_GERER },
        ],
    },
    {
        groupe: 'Ventes',
        items: [
            { label: 'Caisse (POS)',   href: '/pos',                  icone: ShoppingCart,
              permission: PERMISSIONS.VENTES_CREER, nouvelOnglet: true },
            { label: 'Ventes',         href: '/admin/ventes',         icone: Receipt,
              permission: PERMISSIONS.VENTES_VOIR },
            { label: 'Factures',       href: '/admin/factures',       icone: FileText,
              permission: PERMISSIONS.FACTURES_VOIR },
            { label: 'Rapports',       href: '/admin/rapports',       icone: BarChart3,
              permission: PERMISSIONS.RAPPORTS_GENERER, plan: 'rapports' },
            { label: 'Communications', href: '/admin/communications', icone: Send,
              permission: PERMISSIONS.CLIENTS_VOIR, plan: 'communications' },
        ],
    },
    {
        groupe: 'Stock',
        items: [
            { label: 'Produits',         href: '/stock/produits',              icone: Package,
              permission: PERMISSIONS.PRODUITS_VOIR },
            { label: 'Catégories',       href: '/stock/categories',            icone: Tags,
              permission: PERMISSIONS.PRODUITS_VOIR },
            { label: 'Marques',          href: '/stock/marques',               icone: Award,
              permission: PERMISSIONS.PRODUITS_VOIR },
            { label: 'Entrepôts',        href: '/stock/entrepots',             icone: Warehouse,
              permission: PERMISSIONS.STOCK_VOIR },
            { label: 'Mouvements',       href: '/stock/mouvements',            icone: BarChart3,
              permission: PERMISSIONS.STOCK_VOIR },
            { label: 'Transferts',       href: '/stock/transferts',            icone: ArrowLeftRight,
              permission: PERMISSIONS.STOCK_TRANSFERT },
            { label: 'Ajustements',      href: '/stock/ajustements',           icone: SlidersHorizontal,
              permission: PERMISSIONS.STOCK_AJUSTEMENT },
            { label: 'Retours',          href: '/stock/retours',               icone: Undo2,
              permission: PERMISSIONS.VENTES_RETOUR },
        ],
    },
    {
        groupe: 'Achats',
        items: [
            { label: 'Fournisseurs',     href: '/stock/fournisseurs',          icone: Truck,
              permission: PERMISSIONS.FOURNISSEURS_VOIR },
            { label: 'Bons de commande', href: '/stock/bons-de-commande',      icone: ClipboardList,
              permission: PERMISSIONS.BONS_COMMANDE_CREER },
            { label: 'Réceptions',       href: '/stock/receptions',            icone: PackageCheck,
              permission: PERMISSIONS.RECEPTION_CREER },
            { label: 'Fact. fournisseur', href: '/stock/factures-fournisseurs', icone: FileInput,
              permission: PERMISSIONS.FACTURE_FOURNISSEUR_SAISIR },
        ],
    },
    {
        groupe: 'Comptabilité',
        items: [
            { label: 'Tableau de bord', href: '/compta/dashboard',  icone: LayoutDashboard,
              permission: PERMISSIONS.COMPTABILITE_VOIR },
            { label: 'Caisse',          href: '/compta/caisse',     icone: Wallet,
              permission: PERMISSIONS.COMPTABILITE_VOIR },
            { label: 'Dépenses',        href: '/compta/depenses',   icone: Receipt,
              permission: PERMISSIONS.DEPENSES_CREER },
            { label: 'Salaires',        href: '/compta/salaires',   icone: Users,
              permission: PERMISSIONS.SALAIRES_GERER },
            { label: 'Inventaire',      href: '/compta/inventaire', icone: ClipboardCheck,
              permission: PERMISSIONS.STOCK_INVENTAIRE_CREER },
        ],
    },
]
