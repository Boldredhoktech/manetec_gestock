'use client'

// Clair / Sombre / Appareil — appliqué tout de suite, enregistré sur le compte.

import { useEffect, useState, useTransition } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { changerTheme } from '@/actions/preferences'
import { COOKIE_THEME, ID_RACINE_APP, type Theme } from '@/lib/theme'

const CHOIX: { theme: Theme; label: string; Icone: React.ElementType }[] = [
    { theme: 'clair',   label: 'Thème clair',            Icone: Sun },
    { theme: 'sombre',  label: 'Thème sombre',           Icone: Moon },
    { theme: 'systeme', label: 'Thème de l\'appareil',   Icone: Monitor },
]

function appliquer(theme: Theme) {
    const racine = document.getElementById(ID_RACINE_APP)
    if (!racine) return
    racine.dataset.theme = theme
    const sombre = theme === 'sombre' || (theme === 'systeme' && matchMedia('(prefers-color-scheme: dark)').matches)
    racine.classList.toggle('dark', sombre)
}

export default function SelecteurTheme({ compact = false }: { compact?: boolean }) {
    const [actuel, setActuel] = useState<Theme>('systeme')
    const [, demarrer] = useTransition()

    useEffect(() => {
        const t = document.getElementById(ID_RACINE_APP)?.dataset.theme as Theme | undefined
        if (t) setActuel(t)
        // « Appareil » suit le changement du réglage du téléphone / de l'ordinateur.
        const mq = matchMedia('(prefers-color-scheme: dark)')
        const suivre = () => { if (document.getElementById(ID_RACINE_APP)?.dataset.theme === 'systeme') appliquer('systeme') }
        mq.addEventListener('change', suivre)
        return () => mq.removeEventListener('change', suivre)
    }, [])

    function choisir(t: Theme) {
        setActuel(t); appliquer(t)
        // Le cookie est écrit tout de suite : un rechargement immédiat garde
        // le choix, même si l'enregistrement sur le compte n'est pas fini.
        document.cookie = `${COOKIE_THEME}=${t}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
        demarrer(async () => { await changerTheme(t) })
    }

    return (
        <div role="group" aria-label="Thème" className={`flex gap-1 p-1 rounded-xl bg-white/5 ${compact ? 'flex-col' : ''}`}>
            {CHOIX.map(({ theme, label, Icone }) => (
                <button key={theme} type="button" aria-pressed={actuel === theme} aria-label={label} title={label}
                        onClick={() => choisir(theme)}
                        className={`flex-1 h-9 rounded-lg flex items-center justify-center transition-colors ${
                            actuel === theme ? 'bg-[#FACC15] text-[#1A1400]' : 'text-[#C9D4F0] hover:bg-white/10'
                        }`}>
                    <Icone className="w-4 h-4" aria-hidden="true" />
                </button>
            ))}
        </div>
    )
}
