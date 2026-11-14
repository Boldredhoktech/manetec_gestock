'use client'

// ═══════════════════════════════════════════════════════════════
// Modale du nouveau design (lot 1) — TOUS les formulaires de création et
// de modification y passeront (décision du 14/11).
//   • ordinateur / tablette : fenêtre centrée, largeur selon `taille` ;
//   • téléphone : panneau qui monte du bas, une colonne, poignée ;
//   • en-tête et pied fixes : seul le corps défile, les boutons restent
//     toujours visibles ;
//   • Radix Dialog : focus piégé, Échap ferme, lecteurs d'écran.
// Le portail est rendu DANS #app-manetec pour hériter du thème.
// ═══════════════════════════════════════════════════════════════

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { createContext, useContext, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ID_RACINE_APP } from '@/lib/theme'

/** Vrai à l'intérieur d'une modale : les pieds de formulaire s'y collent en bas. */
export const ContexteModale = createContext(false)
export const useDansModale = () => useContext(ContexteModale)

const LARGEURS = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' } as const

export interface PropsModale {
    ouvert:       boolean
    onFermer:     () => void
    titre:        string
    description?: string
    taille?:      keyof typeof LARGEURS
    /** Boutons d'action (Annuler / Enregistrer…), toujours visibles. */
    pied?:        React.ReactNode
    children:     React.ReactNode
}

export default function Modale({ ouvert, onFermer, titre, description, taille = 'md', pied, children }: PropsModale) {
    const [racine, setRacine] = useState<HTMLElement | null>(null)
    useEffect(() => { setRacine(document.getElementById(ID_RACINE_APP)) }, [])

    return (
        <Dialog.Root open={ouvert} onOpenChange={o => { if (!o) onFermer() }}>
            <Dialog.Portal container={racine ?? undefined}>
                <Dialog.Overlay className="fixed inset-0 z-[60] bg-[#080E1F]/55 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
                <Dialog.Content
                    className={cn(
                        'fixed z-[61] flex flex-col bg-card text-card-foreground shadow-2xl outline-none',
                        // Téléphone : panneau du bas
                        'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl',
                        'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
                        // ≥ 640 px : fenêtre centrée
                        'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[calc(100%-2rem)] sm:max-h-[88dvh] sm:rounded-2xl',
                        'sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
                        LARGEURS[taille],
                    )}
                >
                    <div aria-hidden="true" className="flex justify-center pt-2 sm:hidden">
                        <span className="h-1.5 w-10 rounded-full bg-border" />
                    </div>
                    <header className="flex items-start gap-3 px-5 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-border">
                        <div className="flex-1 min-w-0">
                            <Dialog.Title className="titre-design text-lg sm:text-xl font-bold text-foreground">{titre}</Dialog.Title>
                            {description
                                ? <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>
                                : <Dialog.Description className="sr-only">{titre}</Dialog.Description>}
                        </div>
                        <Dialog.Close aria-label="Fermer"
                                      className="w-10 h-10 shrink-0 rounded-xl border border-border flex items-center justify-center text-foreground hover:bg-muted">
                            <X className="w-4 h-4" aria-hidden="true" />
                        </Dialog.Close>
                    </header>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
                        <ContexteModale.Provider value={true}>{children}</ContexteModale.Provider>
                    </div>
                    {pied && (
                        <footer className="flex flex-wrap justify-end gap-2.5 px-5 sm:px-6 py-4 border-t border-border bg-[var(--surface2)] rounded-b-none sm:rounded-b-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
                            {pied}
                        </footer>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
