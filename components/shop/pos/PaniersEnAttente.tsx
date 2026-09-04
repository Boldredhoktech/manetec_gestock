'use client'

import { PauseCircle, Play, Trash2 } from 'lucide-react'
import type { PanierEnAttente } from '@/hooks/usePanierPersistant'
import type { LigneVente } from '@/actions/ventes'

// Mettre de côté un client qui cherche sa monnaie pour servir le
// suivant : le geste le plus courant d'un comptoir, et il n'existait
// pas. Les paniers vivent dans le navigateur (décision D4) — ils
// n'engagent rien tant qu'ils ne sont pas encaissés.
export default function PaniersEnAttente({
    paniers, onReprendre, onRetirer, onMettreDeCote, panierCourantVide,
}: {
    paniers:           PanierEnAttente<LigneVente>[]
    onReprendre:       (id: string) => void
    onRetirer:         (id: string) => void
    onMettreDeCote:    () => void
    panierCourantVide: boolean
}) {
    // Rien à montrer et rien à mettre de côté : on n'encombre pas
    // l'écran le plus utilisé du logiciel.
    if (paniers.length === 0 && panierCourantVide) return null

    function heure(iso: string): string {
        return new Date(iso).toLocaleTimeString('fr-FR', {
            hour: '2-digit', minute: '2-digit',
            timeZone: 'Africa/Porto-Novo',
        })
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <PauseCircle className="w-4 h-4 text-[#15335a]" />
                    Paniers en attente
                    {paniers.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#15335a] text-white text-[11px] font-bold">
                            {paniers.length}
                        </span>
                    )}
                </h3>

                {!panierCourantVide && (
                    <button type="button" onClick={onMettreDeCote}
                            className="text-xs font-bold text-[#15335a] hover:text-[#0f2742] transition-colors">
                        Mettre de côté
                    </button>
                )}
            </div>

            {paniers.length > 0 && (
                <ul className="space-y-1.5">
                    {paniers.map(p => (
                        <li key={p.id}
                            className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-800 truncate">
                                    {p.clientNom ?? 'Client de passage'}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {p.libelle} · {heure(p.misEnAttenteLe)}
                                </p>
                            </div>
                            <button type="button" onClick={() => onReprendre(p.id)}
                                    aria-label="Reprendre ce panier"
                                    className="p-1.5 rounded-lg text-[#15335a] hover:bg-white transition-colors">
                                <Play className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => onRetirer(p.id)}
                                    aria-label="Abandonner ce panier"
                                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
