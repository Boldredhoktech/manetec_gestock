// lib/dates/periode.ts
// ═══════════════════════════════════════════════════════════════
// Bornes de période, calculées au même endroit pour tout le module
// comptable.
//
// Deux défauts corrigés ici :
//
// 1. `new Date(annee, mois - 1, 1).toISOString()` construit une date
//    dans le fuseau du SERVEUR puis la convertit en UTC. Sur Vercel
//    (UTC) le résultat est juste par accident ; sur une machine à
//    UTC+1, le mois commence la veille. On passe par `Date.UTC`, qui ne
//    dépend d'aucun fuseau.
//
// 2. Les colonnes `created_at` sont des instants (timestamptz) alors
//    que `date_depense` et `date_paiement` sont des jours. Comparer un
//    instant à « AAAA-MM-JJT00:00:00 » revient à comparer en UTC, alors
//    que la boutique vit à UTC+1 : une vente de 00 h 30 le 1er tombait
//    dans le mois précédent.
//
// La boutique est au Bénin, UTC+1 toute l'année (pas d'heure d'été).
// Le décalage est déclaré une fois ici : le jour où le logiciel
// desservira un autre fuseau, c'est cette constante qui deviendra une
// colonne de `shops`, et rien d'autre ne bougera.
// ═══════════════════════════════════════════════════════════════

export const DECALAGE_BOUTIQUE_HEURES = 1

/** Premier et dernier jour d'un mois, au format AAAA-MM-JJ. */
export function bornesDuMois(mois: number, annee: number): { debut: string; fin: string } {
    return {
        debut: `${annee}-${String(mois).padStart(2, '0')}-01`,
        // Jour 0 du mois suivant = dernier jour du mois demandé.
        fin: new Date(Date.UTC(annee, mois, 0)).toISOString().split('T')[0],
    }
}

/**
 * Instant UTC correspondant au début d'un jour DANS LA BOUTIQUE.
 * Le 1er septembre à 00 h 00 heure locale, c'est le 31 août à 23 h 00 UTC.
 */
export function debutJourBoutique(jour: string): string {
    const [a, m, j] = jour.split('-').map(Number)
    return new Date(Date.UTC(a, m - 1, j, -DECALAGE_BOUTIQUE_HEURES)).toISOString()
}

/**
 * Instant UTC correspondant à la fin d'un jour dans la boutique,
 * borne exclue : le lendemain 00 h 00 locale.
 * À utiliser avec `.lt()`, jamais `.lte()`.
 */
export function finJourBoutiqueExclue(jour: string): string {
    const [a, m, j] = jour.split('-').map(Number)
    return new Date(Date.UTC(a, m - 1, j + 1, -DECALAGE_BOUTIQUE_HEURES)).toISOString()
}

/** Bornes d'un instant (`created_at`) pour une période exprimée en jours. */
export function bornesInstant(debut: string, fin: string): { de: string; avant: string } {
    return { de: debutJourBoutique(debut), avant: finJourBoutiqueExclue(fin) }
}

/** Les `nbMois` mois qui se terminent au mois demandé, du plus ancien au plus récent. */
export function derniersMois(
    mois: number,
    annee: number,
    nbMois: number,
): { mois: number; annee: number }[] {
    const suite: { mois: number; annee: number }[] = []
    for (let i = nbMois - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(annee, mois - 1 - i, 1))
        suite.push({ mois: d.getUTCMonth() + 1, annee: d.getUTCFullYear() })
    }
    return suite
}

export const MOIS_FR = [
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export const MOIS_FR_COURT = [
    '', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
    'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
]
