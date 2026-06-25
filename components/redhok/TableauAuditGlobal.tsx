'use client'

import { useState, useMemo } from 'react'
import { History, Search, Store, ShieldCheck, User, ShieldAlert } from 'lucide-react'
import { formatDateHeure } from '@/lib/utils'

export interface LogAuditGlobal {
    id: string
    event_type: string
    type_acteur: string
    user_nom: string | null
    details_json: any
    created_at: string
    reference_public_id?: string | null
    shop_nom?: string | null
    shop_public_id?: string | null
    acteur_role?: string | null   // mode agents : super_platform_admin | platform_agent
}

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
    SHOP_USER_UNBLOCKED:           'Utilisateur débloqué',
    USER_CREATED:                  'Utilisateur créé',
    USER_UNBLOCKED:                'Utilisateur débloqué',
    AGENT_CREATED:                 'Agent plateforme créé',
    ALL_SHOPS_DELETED:             'Suppression de toutes les boutiques',
}

function libelle(ev: string) {
    return EVENTS[ev] ?? ev.replace(/_/g, ' ').toLowerCase()
}

function details(l: LogAuditGlobal): string {
    const d = l.details_json
    const parts: string[] = []
    if (d && typeof d === 'object') {
        if (d.identifiant)    parts.push(`identifiant: ${d.identifiant}`)
        if (d.nouveau_plan)   parts.push(`plan: ${d.nouveau_plan}`)
        if (d.role)           parts.push(`rôle: ${d.role}`)
        if (d.note)           parts.push(`note: ${d.note}`)
        if (d.email)          parts.push(d.email)
    }
    if (l.reference_public_id) parts.push(`réf: ${l.reference_public_id}`)
    return parts.join(' · ')
}

export default function TableauAuditGlobal({
    logs, mode, boutiques,
}: {
    logs: LogAuditGlobal[]
    mode: 'boutiques' | 'agents'
    boutiques?: { public_id: string; nom: string }[]
}) {
    const [recherche, setRecherche]   = useState('')
    const [filtreShop, setFiltreShop] = useState('tous')

    const filtres = useMemo(() => logs.filter(l => {
        if (mode === 'boutiques' && filtreShop !== 'tous' && l.shop_public_id !== filtreShop) return false
        const texte = `${libelle(l.event_type)} ${l.user_nom ?? ''} ${l.shop_nom ?? ''} ${details(l)}`.toLowerCase()
        return texte.includes(recherche.toLowerCase())
    }), [logs, recherche, filtreShop, mode])

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <History className="w-4 h-4" />
                    {mode === 'boutiques' ? 'Activité des boutiques' : 'Activité des agents'} ({filtres.length})
                </h2>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            value={recherche}
                            onChange={e => setRecherche(e.target.value)}
                            placeholder="Rechercher..."
                            className="w-48 pl-8 pr-2 py-1.5 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    {mode === 'boutiques' && boutiques && boutiques.length > 0 && (
                        <select
                            value={filtreShop}
                            onChange={e => setFiltreShop(e.target.value)}
                            className="px-2 py-1.5 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring max-w-[180px]"
                        >
                            <option value="tous">Toutes les boutiques</option>
                            {boutiques.map(b => (
                                <option key={b.public_id} value={b.public_id}>{b.nom}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {filtres.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucune entrée d'audit.</p>
            ) : (
                <div className="max-h-[640px] overflow-y-auto -mx-1 px-1">
                    {filtres.map(l => {
                        const estPlateforme = l.type_acteur === 'platform'
                        const estSuperAdmin = l.acteur_role === 'super_platform_admin'
                        const det = details(l)
                        return (
                            <div key={l.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                                <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                                    estPlateforme ? 'bg-[#15335a]/10 text-[#15335a]' : 'bg-muted text-muted-foreground'
                                }`}>
                                    {mode === 'agents'
                                        ? (estSuperAdmin ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />)
                                        : (estPlateforme ? <ShieldCheck className="w-4 h-4" /> : <Store className="w-4 h-4" />)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">{libelle(l.event_type)}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                                        <User className="w-3 h-3" />
                                        <span>{l.user_nom ?? '—'}</span>
                                        {mode === 'agents' && (
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                estSuperAdmin ? 'bg-[#ef5e22]/10 text-[#ef5e22]' : 'bg-[#15335a]/10 text-[#15335a]'
                                            }`}>
                                                {estSuperAdmin ? 'SUPER ADMIN' : 'AGENT'}
                                            </span>
                                        )}
                                        {mode === 'boutiques' && l.shop_nom && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">
                                                {l.shop_nom}
                                            </span>
                                        )}
                                        {l.type_acteur === 'shop' && mode === 'boutiques' && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">BOUTIQUE</span>
                                        )}
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
