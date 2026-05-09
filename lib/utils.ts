import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Formateur de monnaie
export function formatMontant(
    montant: number,
    devise: string = 'FCFA'
): string {
    return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(montant) + ' ' + devise
}

// Formateur de date
export function formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(date))
}

// Formateur date + heure
export function formatDateHeure(date: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date))
}

// Générateur d'identifiant public (côté client uniquement pour affichage)
export function formatPublicId(prefix: string, numero: number): string {
    const padded = numero > 99999
        ? numero.toString().padStart(6, '0')
        : numero.toString().padStart(5, '0')
    return `${prefix}-${padded}`
}