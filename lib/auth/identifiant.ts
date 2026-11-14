// ═══════════════════════════════════════════════════════════════
// Identifiant de connexion boutique : « nom@suffixe »
//
// Depuis la mig 040, plus de ShopId à la connexion : l'identifiant est
// unique sur toute la plateforme et porte la boutique dans son suffixe
// (shops.suffixe_identifiant). Mêmes règles que la base :
//   normaliser_identifiant()   et   CHECK shop_users_identifiant_forme
// Pas de 'use server' : module de règles pures, importable partout.
// ═══════════════════════════════════════════════════════════════

const ACCENTS = /[̀-ͯ]/g

/** Partie « nom » : minuscules, sans accents ni espaces ; garde . _ - */
export function normaliserNomIdentifiant(brut: string): string {
    return (brut ?? '')
        .normalize('NFD').replace(ACCENTS, '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .replace(/^[._-]+/, '')
        .slice(0, 40)
}

/** Suffixe de boutique tiré d'un nom : lettres et chiffres seuls. */
export function suffixeDepuisNom(nomBoutique: string): string {
    const base = (nomBoutique ?? '')
        .normalize('NFD').replace(ACCENTS, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 26)
    return base.length >= 2 ? base : 'boutique'
}

export const FORME_IDENTIFIANT = /^[a-z0-9][a-z0-9._-]{0,39}@[a-z0-9]{2,30}$/

export function composerIdentifiant(nom: string, suffixe: string): string {
    return `${normaliserNomIdentifiant(nom)}@${suffixe}`
}

/** Ce que tape la personne à la connexion (casse et espaces ignorés). */
export function nettoyerSaisieIdentifiant(saisie: string): string {
    return (saisie ?? '').trim().toLowerCase()
}

/**
 * Période de transition : l'identifiant d'avant la mig 040 (sans « @ »)
 * reste accepté jusqu'à cette date, s'il ne désigne qu'UN seul compte.
 * La personne est alors connectée et voit son nouvel identifiant.
 */
export const FIN_TRANSITION_IDENTIFIANT = new Date('2027-01-31T23:59:59Z')

export function transitionIdentifiantOuverte(maintenant = new Date()): boolean {
    return maintenant <= FIN_TRANSITION_IDENTIFIANT
}

/** Cookie (lisible par le serveur) qui affiche le bandeau « nouvel identifiant ». */
export const COOKIE_NOUVEL_IDENTIFIANT = 'manetec_nouvel_identifiant'

type ClientAdmin = {
    from: (table: string) => any
}

/**
 * Suffixe libre pour une nouvelle boutique : base tirée du nom, puis
 * base2, base3… La contrainte UNIQUE en base reste l'arbitre final.
 */
export async function suffixeLibre(client: ClientAdmin, nomBoutique: string): Promise<string> {
    const base = suffixeDepuisNom(nomBoutique)
    const { data } = await client
        .from('shops')
        .select('suffixe_identifiant')
        .like('suffixe_identifiant', `${base}%`)
    const pris = new Set<string>((data ?? []).map((l: { suffixe_identifiant: string }) => l.suffixe_identifiant))
    if (!pris.has(base)) return base
    let n = 2
    while (pris.has(`${base}${n}`)) n++
    return `${base}${n}`
}
