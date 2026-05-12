// lib/config/entreprise.ts
// ═══════════════════════════════════════════════════════════════
// Configuration centrale — Manetec Inter BJ / Manetec Gestock
// Modifiez uniquement ce fichier pour mettre à jour :
//   - Infos de contact
//   - Prix des plans
//   - Logos et images
//   - Textes de la landing page
// ═══════════════════════════════════════════════════════════════

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
        // Logo de Manetec Inter BJ (entreprise)
        // Format recommandé : PNG transparent, 200×60px minimum
        entreprise:   '/images/bold-redhok-logo.png',

        // Logo de l'application Manetec Gestock
        // Format recommandé : PNG transparent, 200×200px minimum (carré)
        application:  '/images/manetec-gestock-logo.png',

        // Favicon (affiché dans l'onglet du navigateur)
        favicon:      '/images/favicon.png',

        // Si les logos ne sont pas encore uploadés, les initiales sont affichées
        // (BR pour Bold Redhok, MG pour Manetec Gestock)
        // Mettre à true quand les fichiers sont en place
        logos_actifs: false,
    },

    // ── Contact principal ────────────────────────────────────────
    telephone_1:      '+229 01 97 05 12 66',
    telephone_2:      '+229 01 95 48 53 49',
    whatsapp:         '+229 0195485349',
    email_contact:    'contact@manetec.com',
    email_support:    'support@manetec.com',
    email_commercial: 'commercial@manetec.com',

    // ── Adresse ──────────────────────────────────────────────────
    adresse:    'Sikecodji, Cotonou, Bénin',
    quartier:   'Sikecodji',
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
            prix_mensuel:   10000,
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
            couleur:       '#1a56db',
            description:   'Pour les PME en croissance',
            cta:           'Nous contacter',
            populaire:     true,
            fonctionnalites: [
                '500 produits',
                '10 utilisateurs',
                '1 000 clients',
                'Factures A4 + Devis',
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
            icone:       '🏪',
            titre:       'Caisse POS moderne',
            description: 'Interface rapide et intuitive pour enregistrer vos ventes, gérer les paiements mixtes et imprimer les reçus.',
        },
        {
            icone:       '📦',
            titre:       'Gestion de stock',
            description: 'Suivez vos produits en temps réel, gérez plusieurs entrepôts et recevez des alertes de rupture.',
        },
        {
            icone:       '🧾',
            titre:       'Facturation A4',
            description: 'Créez des factures professionnelles, des devis et des avoirs. Envoyez-les par email en un clic.',
        },
        {
            icone:       '📊',
            titre:       'Rapports & Analyses',
            description: 'Tableaux de bord en temps réel, rapports ventes, stocks et fournisseurs exportables en PDF.',
        },
        {
            icone:       '👥',
            titre:       'Gestion des clients',
            description: 'Fidélisez vos clients avec un suivi complet, gestion des crédits et historique des achats.',
        },
        {
            icone:       '🚚',
            titre:       'Fournisseurs',
            description: 'Gérez vos fournisseurs, bons de commande, réceptions et paiements depuis une interface unifiée.',
        },
        {
            icone:       '💰',
            titre:       'Comptabilité',
            description: 'Suivez vos dépenses, salaires et faites vos inventaires physiques avec ajustements automatiques.',
        },
        {
            icone:       '🔒',
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
            texte: 'Le POS est très rapide. Mes vendeurs ont appris en une heure. Je recommande vivement.',
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