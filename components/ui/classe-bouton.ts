// Classes des boutons du nouveau design (lot 3) — utilisables côté
// serveur comme côté client (pas de 'use client' ici).
import { cn } from '@/lib/utils'

const VARIANTES = {
    primaire:   'bg-primary text-primary-foreground hover:opacity-90',
    accent:     'bg-[#FACC15] text-[#1A1400] hover:brightness-95',
    secondaire: 'border border-input bg-card text-foreground hover:bg-muted',
    danger:     'border border-[var(--rouge-texte)]/40 bg-[var(--rouge-doux)] text-[var(--rouge-texte)] hover:brightness-95',
} as const

export const classeBouton = (variante: keyof typeof VARIANTES = 'secondaire') =>
    cn('h-11 px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50', VARIANTES[variante])

export type VarianteBouton = keyof typeof VARIANTES
