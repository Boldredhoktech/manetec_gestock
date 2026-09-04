// lib/constants/liens.ts
// ═══════════════════════════════════════════════════════════════
// Les adresses que le code construit a la main finissent par diverger.
//
// La fiche d'une facture fournisseur vit sous /stock/factures-
// fournisseurs/<id>. Un formulaire renvoyait pourtant vers
// /stock/fournisseurs/<fournisseur>/factures/<id>, une route qui n'a
// jamais existe : on validait sa facture et on tombait sur un 404,
// alors qu'elle etait bel et bien enregistree.
//
// Ecrire l'adresse une fois evite qu'un ecran s'eloigne des autres.
// ═══════════════════════════════════════════════════════════════

export const LIENS = {
    factureFournisseur: (id: string) => `/stock/factures-fournisseurs/${id}`,
    fournisseur:        (id: string) => `/stock/fournisseurs/${id}`,
    facturesDuFournisseur: (id: string) => `/stock/fournisseurs/${id}/factures`,
    bonDeCommande:      (id: string) => `/stock/bons-de-commande/${id}`,
    vente:              (id: string) => `/admin/ventes/${id}`,
    facture:            (id: string) => `/admin/factures/${id}`,
} as const
