'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Users, Loader2, KeyRound, Power, Unlock, Check, X, Copy, ShieldAlert,
} from 'lucide-react'
import {
    modifierIdentifiantUserBoutique,
    reinitialiserMdpUserBoutique,
    toggleActifUserBoutique,
    debloquerUserBoutique,
} from '@/actions/shops'

interface Utilisateur {
    id: string
    public_id: string
    nom_complet: string
    identifiant: string
    role: string
    est_actif: boolean
    est_bloque: boolean
}

const ROLE_LABELS: Record<string, string> = {
    super_admin_boutique: 'Super Admin',
    vendeur:              'Vendeur',
    gestionnaire_stock:   'Gestion stock',
    stock_manager:        'Gestion stock',
    comptable:            'Comptable',
}

function LigneUtilisateur({ u, shopId, peutGerer }: { u: Utilisateur; shopId: string; peutGerer: boolean }) {
    const router = useRouter()
    const [identifiant, setIdentifiant] = useState(u.identifiant)
    const [enAttente, setEnAttente]     = useState<string | null>(null)
    const [message, setMessage]         = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)
    const [mdpTemp, setMdpTemp]         = useState<string | null>(null)

    const identModifie = identifiant.trim().toLowerCase() !== u.identifiant

    async function lancer(cle: string, fn: () => Promise<any>) {
        setEnAttente(cle); setMessage(null)
        const res = await fn()
        setEnAttente(null)
        if (res?.erreur) { setMessage({ type: 'err', texte: res.erreur }); return null }
        return res
    }

    async function sauverIdentifiant() {
        const res = await lancer('ident', () => modifierIdentifiantUserBoutique(shopId, u.id, identifiant))
        if (res) { setMessage({ type: 'ok', texte: 'Identifiant mis à jour.' }); router.refresh() }
    }
    async function resetMdp() {
        const res = await lancer('mdp', () => reinitialiserMdpUserBoutique(shopId, u.id))
        if (res?.motDePasse) setMdpTemp(res.motDePasse)
    }
    async function toggleActif() {
        const res = await lancer('actif', () => toggleActifUserBoutique(shopId, u.id, !u.est_actif))
        if (res) router.refresh()
    }
    async function debloquer() {
        const res = await lancer('bloc', () => debloquerUserBoutique(shopId, u.id))
        if (res) { setMessage({ type: 'ok', texte: 'Compte débloqué.' }); router.refresh() }
    }

    return (
        <div className="border border-border rounded-xl p-4 space-y-3">
            {/* En-tête ligne */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{u.nom_complet}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {u.public_id} · {ROLE_LABELS[u.role] ?? u.role}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {u.est_bloque && (
                        <span className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                            <ShieldAlert className="w-3 h-3" /> Bloqué
                        </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.est_actif ? 'text-green-700 bg-green-100' : 'text-gray-500 bg-gray-100'
                    }`}>
                        {u.est_actif ? 'Actif' : 'Inactif'}
                    </span>
                </div>
            </div>

            {/* Identifiant — éditable seulement pour le Super Admin Plateforme */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">Identifiant</span>
                {peutGerer ? (
                    <>
                        <input
                            value={identifiant}
                            onChange={e => setIdentifiant(e.target.value)}
                            className="flex-1 min-w-0 px-2.5 py-1.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                            type="button"
                            onClick={sauverIdentifiant}
                            disabled={!identModifie || enAttente === 'ident'}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#15335a] text-white disabled:opacity-40 hover:bg-[#0f2742] transition-colors"
                        >
                            {enAttente === 'ident' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Enregistrer
                        </button>
                    </>
                ) : (
                    <span className="text-sm font-mono text-foreground">{u.identifiant}</span>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
                {peutGerer && (
                    <button type="button" onClick={resetMdp} disabled={enAttente === 'mdp'}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-input hover:bg-muted transition-colors disabled:opacity-50">
                        {enAttente === 'mdp' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                        Réinitialiser le mot de passe
                    </button>
                )}
                <button type="button" onClick={toggleActif} disabled={enAttente === 'actif'}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                            u.est_actif ? 'border-destructive/30 text-destructive hover:bg-destructive/10' : 'border-green-300 text-green-700 hover:bg-green-50'
                        }`}>
                    {enAttente === 'actif' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                    {u.est_actif ? 'Désactiver' : 'Activer'}
                </button>
                {u.est_bloque && (
                    <button type="button" onClick={debloquer} disabled={enAttente === 'bloc'}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-input hover:bg-muted transition-colors disabled:opacity-50">
                        {enAttente === 'bloc' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                        Débloquer
                    </button>
                )}
            </div>

            {/* Mot de passe temporaire */}
            {mdpTemp && (
                <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-amber-800">Nouveau mot de passe — à communiquer</p>
                        <p className="text-sm font-mono text-amber-900">{mdpTemp}</p>
                    </div>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(mdpTemp)}
                            className="shrink-0 p-1.5 rounded-lg hover:bg-amber-100 text-amber-700" title="Copier">
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Feedback */}
            {message && (
                <p className={`flex items-center gap-1.5 text-xs ${message.type === 'ok' ? 'text-green-600' : 'text-destructive'}`}>
                    {message.type === 'ok' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    {message.texte}
                </p>
            )}
        </div>
    )
}

export default function CarteUtilisateursBoutique({
    shopId, utilisateurs, peutGererIdentifiants,
}: { shopId: string; utilisateurs: Utilisateur[]; peutGererIdentifiants: boolean }) {
    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Utilisateurs de la boutique ({utilisateurs.length})
            </h2>
            {!peutGererIdentifiants && (
                <p className="text-xs text-muted-foreground">
                    La modification des identifiants et des mots de passe est réservée au Super Admin Plateforme.
                </p>
            )}

            {utilisateurs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun utilisateur.</p>
            ) : (
                <div className="space-y-3">
                    {utilisateurs.map(u => (
                        <LigneUtilisateur key={u.id} u={u} shopId={shopId} peutGerer={peutGererIdentifiants} />
                    ))}
                </div>
            )}
        </div>
    )
}
