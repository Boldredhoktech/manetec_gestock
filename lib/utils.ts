import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// ── Formateur de monnaie ────────────────────────────────────────
// Intl.NumberFormat('fr-FR') retourne parfois un séparateur de milliers
// inattendu selon l'environnement Node.js (barre oblique, espace étroite...).
// Cette implémentation manuelle garantit un espace insécable U+00A0
// comme séparateur de milliers, conformément à la typographie française.
export function formatMontant(
    montant: number,
    devise: string = 'FCFA'
): string {
    if (isNaN(montant) || montant === null || montant === undefined) {
        return `0 ${devise}`.trim()
    }

    const arrondi = Math.round(montant)
    const absStr  = Math.abs(arrondi).toString()

    // Insérer une espace insécable (U+00A0) tous les 3 chiffres depuis la droite
    let formate = ''
    for (let i = 0; i < absStr.length; i++) {
        if (i > 0 && (absStr.length - i) % 3 === 0) {
            formate += '\u00A0' // espace insécable
        }
        formate += absStr[i]
    }

    const signe  = arrondi < 0 ? '-' : ''
    const suffix = devise ? ` ${devise}` : ''
    return `${signe}${formate}${suffix}`
}

// Version sans devise — pour les contextes où on affiche juste le nombre
export function formatNombre(montant: number): string {
    return formatMontant(montant, '')
}

// ── Formateur de date ───────────────────────────────────────────
export function formatDate(date: string | Date): string {
    if (!date) return '—'
    try {
        return new Intl.DateTimeFormat('fr-FR', {
            day:   '2-digit',
            month: '2-digit',
            year:  'numeric',
        }).format(new Date(date))
    } catch {
        return '—'
    }
}

// ── Formateur date + heure ──────────────────────────────────────
export function formatDateHeure(date: string | Date): string {
    if (!date) return '—'
    try {
        return new Intl.DateTimeFormat('fr-FR', {
            day:    '2-digit',
            month:  '2-digit',
            year:   'numeric',
            hour:   '2-digit',
            minute: '2-digit',
        }).format(new Date(date))
    } catch {
        return '—'
    }
}

// ── Formateur public_id (côté client uniquement) ────────────────
export function formatPublicId(prefix: string, numero: number): string {
    const padded = numero > 99999
        ? numero.toString().padStart(6, '0')
        : numero.toString().padStart(5, '0')
    return `${prefix}-${padded}`
}