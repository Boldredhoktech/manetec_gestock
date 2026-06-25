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

// ── Montant en toutes lettres (français) ──────────────────────
const _UNITES = [
    'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit',
    'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    'dix-sept', 'dix-huit', 'dix-neuf',
]
const _DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', '', 'quatre-vingt', '']

function _deuxChiffres(n: number): string {
    if (n < 20) return _UNITES[n]
    const d = Math.floor(n / 10), u = n % 10
    if (d === 7) return u === 1 ? 'soixante et onze' : 'soixante-' + _UNITES[10 + u]
    if (d === 9) return 'quatre-vingt-' + _UNITES[10 + u]
    let mot = _DIZAINES[d]
    if (u === 0) return d === 8 ? 'quatre-vingts' : mot
    if (u === 1 && d !== 8) return mot + ' et un'
    return mot + '-' + _UNITES[u]
}

function _troisChiffres(n: number, final: boolean): string {
    if (n === 0) return ''
    const c = Math.floor(n / 100), r = n % 100
    if (c === 0) return _deuxChiffres(r)
    let s = c === 1 ? 'cent' : _UNITES[c] + ' cent'
    if (c > 1 && r === 0 && final) s += 's'
    if (r > 0) s += ' ' + _deuxChiffres(r)
    return s
}

/** Convertit un entier en toutes lettres (français), pour les factures. */
export function nombreEnLettresPDF(montant: number): string {
    let n = Math.round(Math.abs(montant || 0))
    if (n === 0) return 'zéro'
    const milliards = Math.floor(n / 1_000_000_000); n %= 1_000_000_000
    const millions  = Math.floor(n / 1_000_000);     n %= 1_000_000
    const mille     = Math.floor(n / 1000);          const reste = n % 1000
    const parts: string[] = []
    if (milliards > 0) parts.push((milliards === 1 ? 'un' : _troisChiffres(milliards, true)) + ' milliard' + (milliards > 1 ? 's' : ''))
    if (millions > 0)  parts.push((millions === 1 ? 'un' : _troisChiffres(millions, true)) + ' million' + (millions > 1 ? 's' : ''))
    if (mille > 0)     parts.push(mille === 1 ? 'mille' : _troisChiffres(mille, false) + ' mille')
    if (reste > 0)     parts.push(_troisChiffres(reste, true))
    return parts.join(' ').trim()
}

/** Nom de la devise en toutes lettres pour le montant en lettres. */
export function deviseEnLettresPDF(devise: string): string {
    const d = (devise || '').toUpperCase()
    if (d === 'FCFA' || d === 'XOF' || d === 'XAF') return 'francs CFA'
    if (d === 'EUR') return 'euros'
    if (d === 'USD') return 'dollars'
    return devise
}