// lib/abonnement/alertes.ts
// ═══════════════════════════════════════════════════════════════
// Quand prévenir une boutique de son échéance (ABO-11).
//
//   7 j → 1 j avant : « J-7 »  (une fois, même si le cron démarre à J-5)
//   dernier jour    : « J-1 »
//   expirée         : « J0 », puis une relance par semaine, 8 au plus.
//
// Le cron tourne chaque jour ; c'est la mémoire des envois
// (table abonnement_alertes, clé boutique + palier + échéance) qui
// garantit qu'un même palier ne part qu'une fois par échéance.
// ═══════════════════════════════════════════════════════════════

const JOUR = 86_400_000
export const RELANCES_MAX = 8

export function palierAlerte(expiration: Date, maintenant: Date = new Date()): string | null {
    const restant = (expiration.getTime() - maintenant.getTime()) / JOUR

    if (restant > 7) return null
    if (restant > 1) return 'J-7'
    if (restant > 0) return 'J-1'

    const semaines = Math.floor(-restant / 7)
    if (semaines === 0) return 'J0'
    return semaines <= RELANCES_MAX ? `relance-${semaines}` : null
}
