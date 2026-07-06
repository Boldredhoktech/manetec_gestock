'use client'

import { useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════
// ChampNombre — champ de saisie numérique (montants, quantités, %)
// ---------------------------------------------------------------
// Corrige le bug du « 0 collant » : les champs numériques contrôlés
// affichaient toujours un 0 impossible à effacer (value={x} avec x=0
// et onChange = parseFloat(...) || 0).
//
// Principe : on garde un état interne en TEXTE (pas un nombre). Le
// champ peut donc être réellement vide ; on émet 0 (ou `videVaut`)
// au parent sans jamais réimposer « 0 » dans l'affichage.
// ═══════════════════════════════════════════════════════════════

interface Props {
    value: number
    onChange: (valeur: number) => void
    /** Valeur émise quand le champ est laissé vide (défaut 0 ; ex. 1 pour une quantité). */
    videVaut?: number
    /** Saisie d'entiers uniquement (quantités) : pas de séparateur décimal. */
    entier?: boolean
    /** Émet aussi un input caché pour la soumission via FormData. */
    name?: string
    placeholder?: string
    disabled?: boolean
    required?: boolean
    id?: string
    className?: string
    autoFocus?: boolean
    'aria-label'?: string
}

// Valeur numérique -> texte d'affichage. 0 (ou NaN) => '' pour ne
// jamais coller un zéro devant la saisie de l'utilisateur.
function versTexte(v: number): string {
    return v === 0 || Number.isNaN(v) ? '' : String(v)
}

// Texte -> nombre. Les états intermédiaires ('', '-', '.', '-.')
// valent la valeur « vide ».
function versNombre(t: string, videVaut: number): number {
    if (t === '' || t === '-' || t === '.' || t === '-.') return videVaut
    const n = Number(t)
    return Number.isNaN(n) ? videVaut : n
}

export default function ChampNombre({
    value,
    onChange,
    videVaut = 0,
    entier = false,
    name,
    placeholder = '0',
    disabled,
    required,
    id,
    className,
    autoFocus,
    ...rest
}: Props) {
    const [texte, setTexte] = useState(() => versTexte(value))
    const dernierEmis = useRef(value)

    // Resynchronise l'affichage quand la valeur change depuis l'extérieur
    // (ex. sélection d'un produit qui remplit le prix), mais PAS quand le
    // changement vient de notre propre saisie.
    if (value !== dernierEmis.current) {
        dernierEmis.current = value
        if (versNombre(texte, videVaut) !== value) {
            setTexte(versTexte(value))
        }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const brut = e.target.value.replace(',', '.')
        const motif = entier ? /^-?\d*$/ : /^-?\d*\.?\d*$/
        if (!motif.test(brut)) return // ignore la frappe invalide

        setTexte(brut)
        const n = versNombre(brut, videVaut)
        dernierEmis.current = n
        onChange(n)
    }

    return (
        <>
            <input
                type="text"
                inputMode={entier ? 'numeric' : 'decimal'}
                value={texte}
                onChange={handleChange}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                id={id}
                autoFocus={autoFocus}
                className={className}
                {...rest}
            />
            {name && (
                <input type="hidden" name={name} value={versNombre(texte, videVaut)} />
            )}
        </>
    )
}
