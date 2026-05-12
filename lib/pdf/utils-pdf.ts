// lib/pdf/utils-pdf.ts
// ═══════════════════════════════════════════════════════════════
// Utilitaires de formatage pour les documents PDF (@react-pdf/renderer)
//
// IMPORTANT : les composants @react-pdf/renderer s'exécutent dans
// un environnement différent de Node.js. Intl.NumberFormat n'y est
// pas toujours disponible. Cette implémentation manuelle est garantie
// de fonctionner dans tous les contextes PDF.
// ═══════════════════════════════════════════════════════════════

/**
 * Formate un montant avec séparateur de milliers (espace insécable)
 * pour les documents PDF. Compatible avec @react-pdf/renderer.
 */
export function formatMontantPDF(
    montant: number,
    devise: string = 'FCFA'
): string {
    if (montant === null || montant === undefined || isNaN(montant)) {
        return `0 ${devise}`.trim()
    }

    const arrondi = Math.round(montant)
    const absStr  = Math.abs(arrondi).toString()

    let formate = ''
    for (let i = 0; i < absStr.length; i++) {
        if (i > 0 && (absStr.length - i) % 3 === 0) {
            formate += ' ' // espace simple — les PDF rendent mieux avec un espace simple
        }
        formate += absStr[i]
    }

    const signe  = arrondi < 0 ? '-' : ''
    const suffix = devise ? ` ${devise}` : ''
    return `${signe}${formate}${suffix}`
}

/**
 * Formate une date au format JJ/MM/AAAA pour les PDF.
 */
export function formatDatePDF(date: string | Date | null | undefined): string {
    if (!date) return '—'
    try {
        const d = new Date(date)
        const j = d.getDate().toString().padStart(2, '0')
        const m = (d.getMonth() + 1).toString().padStart(2, '0')
        const a = d.getFullYear()
        return `${j}/${m}/${a}`
    } catch {
        return '—'
    }
}

/**
 * Formate un pourcentage pour les PDF.
 */
export function formatPctPDF(valeur: number): string {
    if (isNaN(valeur)) return '0%'
    return `${Math.round(valeur * 10) / 10}%`
}