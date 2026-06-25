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
    // Modifiez les prix ici pour qu'ils s'affichent automatiquement
    // sur la landing page et partout dans l'application.
    plans: [
        {
            id:          'starter',
            nom:         'Starter',
            // Prix affiché sur la landing page
            // Exemples : 'Gratuit', '5 000 FCFA', '€9.99'
            prix_affiche:   'Gratuit',
            prix_mensuel:   0,
            devise_prix:    'FCFA',
            duree:          '30 jours d\'essai',
            couleur:        '#64748b',
            description:    'Pour découvrir la solution',
            cta:            'Commencer gratuitement',
            populaire:      false,
            fonctionnalites: [
                '50 produits maximum',
                '2 utilisateurs',
                '100 clients',
                'Caisse POS',
                'Gestion de stock',
                'Reçus thermiques',
            ],
        },
        {
            id:           'pro',
            nom:          'Pro',
            prix_affiche:  '15 000 FCFA',
            prix_mensuel:  15000,
            devise_prix:   'FCFA',
            duree:         'par mois',
            couleur:       '#15335a',
            description:   'Pour les PME en croissance',
            cta:           'Nous contacter',
            populaire:     true,
            fonctionnalites: [
                '500 produits',
                '10 utilisateurs',
                '1 000 clients',
                'Factures A4 + Proforma',
                'Multi-entrepôts',
                'Rapports avancés',
                'Alertes stock email',
            ],
        },
        {
            id:           'enterprise',
            nom:          'Enterprise',
            prix_affiche:  'Sur devis',
            prix_mensuel:  null,
            devise_prix:   'FCFA',
            duree:         'par mois',
            couleur:       '#059669',
            description:   'Pour les grandes structures',
            cta:           'Nous contacter',
            populaire:     false,
            fonctionnalites: [
                'Produits illimités',
                'Utilisateurs illimités',
                'Clients illimités',
                'Tout du plan Pro',
                'Emails promotionnels',
                'Support prioritaire',
                'Formation incluse',
            ],
        },
    ],

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