// lib/config/entreprise.ts
// ═══════════════════════════════════════════════════════════════
// Configuration centrale — Bold Redhok Tech / Manetec Gestock
// Modifiez uniquement ce fichier pour mettre à jour :
//   - Infos de contact
//   - Prix des plans
//   - Logos et images
//   - Textes de la landing page
// ═══════════════════════════════════════════════════════════════

import {
    ShoppingCart, Package, FileText, BarChart3,
    Users, Truck, Wallet, Lock,
} from 'lucide-react'
import { PLANS_ORDONNES, fichePlan, fonctionnalitesPlan, formatMontant, JOURS_ESSAI } from '@/lib/abonnement/catalogue'

export const ENTREPRISE = {

    // ── Identité ────────────────────────────────────────────────
    nom:             'Manetec Inter BJ',
    produit:         'Manetec Gestock',
    slogan:          'La gestion commerciale intelligente pour l\'Afrique',
    description:     'Solution complète de gestion de stock, caisse, facturation et comptabilité pour les PME africaines.',
    annee_fondation: 2024,

    // ── Logos et images ──────────────────────────────────────────
    // Placez vos fichiers dans /public/images/ et mettez à jour les chemins
    logos: {
        // Logo de Bold Redhok Tech (entreprise)
        // Format recommandé : PNG transparent, 200×60px minimum
        entreprise:   '/logo/app_logo.png',

        // Logo de l'application Manetec Gestock
        // Fichier : public/logo/app_logo.png
        application:  '/logo/app_logo.png',

        // Favicon (affiché dans l'onglet du navigateur)
        favicon:      '/logo/app_logo.png',

        // true = afficher le vrai logo, false = afficher les initiales MG
        logos_actifs: true,
    },

    // ── Contact principal ────────────────────────────────────────
    telephone_1:      '+229 01 97 05 12 66',
    telephone_2:      '+229 01 95 48 53 49',
    whatsapp:         '+229 01 95 48 53 49',
    email_contact:    'contact@manetec.app',
    email_support:    'support@manetec.app',
    email_commercial: 'commercial@manetec.app',

    // ── Adresse ──────────────────────────────────────────────────
    adresse:    'Cotonou, Bénin',
    quartier:   'Cadjehoun',
    ville:      'Cotonou',
    pays:       'Bénin',

    // ── Réseaux sociaux ──────────────────────────────────────────
    site_web:   'https://manetec.app',
    linkedin:   'https://linkedin.com/company/manetec',
    facebook:   'https://facebook.com/manetec',
    twitter:    'https://twitter.com/manetec',
    instagram:  'https://instagram.com/manetec',

    // ── Plans tarifaires ─────────────────────────────────────────
    // Les prix, durées et fonctionnalités vivent dans
    // lib/abonnement/catalogue.ts (source unique, ABO-08) : ne rien
    // recopier ici, ce tableau n'en est que la présentation.
    plans: PLANS_ORDONNES.map(id => {
        const f = fichePlan(id)
        return {
            id,
            nom:             f.label,
            description:     f.description,
            prix_affiche:    f.prixMensuel === null ? 'Sur devis' : formatMontant(f.prixMensuel),
            prix_mensuel:    f.prixMensuel,
            duree:           f.prixMensuel === null ? '' : 'par mois',
            couleur:         f.couleur,
            // D2 révisé : toute boutique commence par l'essai gratuit, puis
            // choisit Starter ou Pro. Enterprise reste sur devis (D7).
            inscription:     f.payableEnLigne,
            cta:             f.payableEnLigne ? `Essayer ${JOURS_ESSAI} jours gratuitement` : 'Nous contacter',
            populaire:       f.populaire,
            fonctionnalites: fonctionnalitesPlan(id),
        }
    }),

    // ── Fonctionnalités clés (section landing page) ───────────────
    fonctionnalites_cles: [
        {
            icone:       ShoppingCart,
            titre:       'Caisse POS moderne',
            description: 'Interface rapide et intuitive pour enregistrer vos ventes, gérer les paiements mixtes et imprimer les reçus.',
        },
        {
            icone:       Package,
            titre:       'Gestion de stock',
            description: 'Suivez vos produits en temps réel, gérez plusieurs entrepôts et recevez des alertes de rupture.',
        },
        {
            icone:       FileText,
            titre:       'Facturation A4',
            description: 'Créez des factures professionnelles, des devis et des avoirs. Envoyez-les par email en un clic.',
        },
        {
            icone:       BarChart3,
            titre:       'Rapports & Analyses',
            description: 'Tableaux de bord en temps réel, rapports ventes, stocks et fournisseurs exportables en PDF.',
        },
        {
            icone:       Users,
            titre:       'Gestion des clients',
            description: 'Fidélisez vos clients avec un suivi complet, gestion des crédits et historique des achats.',
        },
        {
            icone:       Truck,
            titre:       'Fournisseurs',
            description: 'Gérez vos fournisseurs, bons de commande, réceptions et paiements depuis une interface unifiée.',
        },
        {
            icone:       Wallet,
            titre:       'Comptabilité',
            description: 'Suivez vos dépenses, salaires et faites vos inventaires physiques avec ajustements automatiques.',
        },
        {
            icone:       Lock,
            titre:       'Multi-utilisateurs',
            description: 'Créez des comptes vendeurs, gestionnaires et comptables avec des permissions personnalisées.',
        },
    ],

    // ── Témoignages ───────────────────────────────────────────────
    temoignages: [
        {
            nom:   'Kofi Mensah',
            poste: 'Gérant, Électronique Plus',
            ville: 'Cotonou',
            texte: 'Manetec Gestock a transformé notre gestion. En moins d\'une semaine, notre stock était parfaitement suivi.',
            note:  5,
        },
        {
            nom:   'Aminata Diallo',
            poste: 'Directrice, Boutique Mode',
            ville: 'Lomé',
            texte: 'La facturation A4 nous a fait gagner en professionnalisme. Nos clients sont impressionnés.',
            note:  5,
        },
        {
            nom:   'Jean-Baptiste Okou',
            poste: 'Propriétaire, Quincaillerie Centrale',
            ville: 'Abidjan',
            texte: 'Le POS est très rapide. Mes vendeurs ont appris en 5 minutes. Je recommande vivement.',
            note:  5,
        },
    ],

    // ── Statistiques (section chiffres) ──────────────────────────
    statistiques: [
        { valeur: '500+',  label: 'Boutiques actives'   },
        { valeur: '50K+',  label: 'Ventes enregistrées' },
        { valeur: '8',     label: 'Pays couverts'        },
        { valeur: '99.9%', label: 'Disponibilité'        },
    ],

} as const

export type PlanConfig = typeof ENTREPRISE.plans[number]