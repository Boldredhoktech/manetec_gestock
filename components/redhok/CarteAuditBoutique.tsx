'use client'

import { useState } from 'react'
import { History, Search, Store, ShieldCheck, User } from 'lucide-react'
import { formatDateHeure } from '@/lib/utils'

interface LogAudit {
    id: string
    event_type: string
    type_acteur: string
    user_nom: string | null
    user_public_id: string | null
    reference_type: string | null
    reference_public_id: string | null
    details_json: any
    created_at: string
}

// Libellés lisibles des événements
const EVENTS: Record<string, string> = {
    AUTH_LOGIN_SUCCESS:            'Connexion réussie',
    SHOP_CREATED:                  'Boutique créée',
    SHOP_PLAN_CHANGED:             'Abonnement modifié',
    SHOP_ACTIVATED:                'Boutique activée',
    SHOP_DEACTIVATED:              'Boutique désactivée',
    SHOP_USER_IDENTIFIANT_CHANGED: 'Identifiant utilisateur modifié',
    SHOP_USER_PASSWORD_RESET:      'Mot de passe réinitialisé',
    SHOP_USER_ACTIVATED:           'Utilisateur activé',
    SHOP_USER_DEACTIVATED:         'Utilisateur désactivé',
    SHOP_USER_UNBLOCKED:           'Utilisateur débloqué (plateforme)',
    USER_CREATED:                  'Utilisateur créé',
    USER_UNBLOCKED:                'Utilisateur débloqué',
    AGENT_CREATED:                 'Agent plateforme créé',
}

function libelle(ev: string) {
    return EVENTS[ev] ?? ev.replace(/_/g, ' ').toLowerCase()
}

function detailsLisibles(log: LogAudit): string {
    const d = log.details_json
    if (!d || typeof d !== 'object') return ''
    const parts: string[] = []
    if (d.identifiant)   parts.push(`identifiant: ${d.identifiant}`)
    if (d.nouveau_plan)  parts.push(`plan: ${d.nouveau_plan}`)
    if (d.role)          parts.push(`rôle: ${d.role}`)
    if (d.note)          parts.push(`note: ${d.note}`)
    if (log.reference_public_id) parts.push(`réf: ${log.reference_public_id}`)
    return parts.join(' · ')
}

export default function CarteAuditBoutique({ logs }: { logs: LogAudit[] }) {
    const [recherche, setRecherche] = useState('')
    const [filtreActeur, setFiltreActeur] = useState<'tous' | 'platform' | 'shop'>('tous')

    const filtres = logs.filter(l => {
        const matchActeur = filtreActeur === 'tous' || l.type_acteur === filtreActeur
        const texte = `${libelle(l.event_type)} ${l.user_nom ?? ''} ${detailsLisibles(l)}`.toLowerCase()
        const matchRecherche = texte.includes(recherche.toLowerCase())
        return matchActeur && matchRecherche
    })

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Historique d'audit ({logs.length})
                </h2>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            value={recherche}
                            onChange={e => setRecherche(e.target.value)}
                            placeholder="Rechercher..."
                            className="w-44 pl-8 pr-2 py-1.5 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    <select
                        value={filtreActeur}
                        onChange={e => setFiltreActeur(e.target.value as any)}
                        className="px-2 py-1.5 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="tous">Tous</option>
                        <option value="platform">Plateforme</option>
                        <option value="shop">Boutique</option>
                    </select>
                </div>
            </div>

            {filtres.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucune entrée.</p>
            ) : (
                <div className="space-y-0 max-h-[480px] overflow-y-auto -mx-1 px-1">
                    {filtres.map(l => {
                        const estPlateforme = l.type_acteur === 'platform'
                        const det = detailsLisibles(l)
                        return (
                            <div key={l.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                                <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                                    estPlateforme ? 'bg-[#15335a]/10 text-[#15335a]' : 'bg-muted text-muted-foreground'
                                }`}>
                                    {estPlateforme ? <ShieldCheck className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">{libelle(l.event_type)}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                                        <User className="w-3 h-3" />
                                        <span>{l.user_nom ?? '—'}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            estPlateforme ? 'bg-[#15335a]/10 text-[#15335a]' : 'bg-muted text-muted-foreground'
                                        }`}>
                                            {estPlateforme ? 'PLATEFORME' : 'BOUTIQUE'}
                                        </span>
                                        {det && <span className="text-muted-foreground/80">· {det}</span>}
                                    </p>
                                </div>
                                <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                                    {formatDateHeure(l.created_at)}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
