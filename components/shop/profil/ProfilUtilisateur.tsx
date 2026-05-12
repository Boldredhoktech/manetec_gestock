'use client'

import { useState } from 'react'
import { changerMotDePasse, modifierNomComplet } from '@/actions/users'
import {
    User, Lock, CheckCircle, AlertCircle,
    Loader2, Eye, EyeOff, Shield, Calendar,
    Building2,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Props {
    utilisateur: {
        id:          string
        public_id:   string
        nom_complet: string
        identifiant: string
        role:        string
        created_at:  string
        est_actif:   boolean
    }
    boutique: {
        nom:            string
        plan:           string
        plan_expire_le: string | null
        devise:         string
    }
}

const PLAN_CONFIG: Record<string, { label: string; couleur: string; bg: string }> = {
    starter:    { label: 'Starter',    couleur: 'text-gray-600',  bg: 'bg-gray-100'  },
    pro:        { label: 'Pro',        couleur: 'text-blue-700',  bg: 'bg-blue-100'  },
    enterprise: { label: 'Enterprise', couleur: 'text-green-700', bg: 'bg-green-100' },
}

interface EtatMsg { type: 'succes' | 'erreur'; texte: string }

export default function ProfilUtilisateur({ utilisateur, boutique }: Props) {
    // ── Modification du nom ─────────────────────────────────────
    const [nom,          setNom]          = useState(utilisateur.nom_complet)
    const [nomEnCours,   setNomEnCours]   = useState(false)
    const [msgNom,       setMsgNom]       = useState<EtatMsg | null>(null)

    // ── Changement de mot de passe ──────────────────────────────
    const [actuel,       setActuel]       = useState('')
    const [nouveau,      setNouveau]      = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [mdpEnCours,   setMdpEnCours]   = useState(false)
    const [msgMdp,       setMsgMdp]       = useState<EtatMsg | null>(null)
    const [voirActuel,   setVoirActuel]   = useState(false)
    const [voirNouveau,  setVoirNouveau]  = useState(false)
    const [voirConfirm,  setVoirConfirm]  = useState(false)

    const planConfig    = PLAN_CONFIG[boutique.plan] ?? PLAN_CONFIG.starter
    const joursRestants = boutique.plan_expire_le
        ? Math.max(0, Math.ceil((new Date(boutique.plan_expire_le).getTime() - Date.now()) / 86400000))
        : null

    // ── Sauvegarder le nom ──────────────────────────────────────
    async function handleSauvegarderNom() {
        if (!nom.trim() || nom === utilisateur.nom_complet) return
        setNomEnCours(true)
        setMsgNom(null)
        const res = await modifierNomComplet(utilisateur.id, nom.trim())
        setNomEnCours(false)
        if (res?.erreur) setMsgNom({ type: 'erreur', texte: res.erreur })
        else setMsgNom({ type: 'succes', texte: 'Nom mis à jour avec succès.' })
    }

    // ── Changer le mot de passe ─────────────────────────────────
    async function handleChangerMdp() {
        if (!actuel || !nouveau || !confirmation) {
            setMsgMdp({ type: 'erreur', texte: 'Tous les champs sont obligatoires.' })
            return
        }
        if (nouveau.length < 6) {
            setMsgMdp({ type: 'erreur', texte: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' })
            return
        }
        if (nouveau !== confirmation) {
            setMsgMdp({ type: 'erreur', texte: 'Le nouveau mot de passe et la confirmation ne correspondent pas.' })
            return
        }
        if (nouveau === actuel) {
            setMsgMdp({ type: 'erreur', texte: 'Le nouveau mot de passe doit être différent de l\'actuel.' })
            return
        }

        setMdpEnCours(true)
        setMsgMdp(null)

        const formData = new FormData()
        formData.set('userId',              utilisateur.id)
        formData.set('motDePasseActuel',    actuel)
        formData.set('nouveauMotDePasse',   nouveau)

        const res = await changerMotDePasse(formData)
        setMdpEnCours(false)

        if (res?.erreur) {
            setMsgMdp({ type: 'erreur', texte: res.erreur })
        } else {
            setMsgMdp({ type: 'succes', texte: 'Mot de passe changé avec succès !' })
            setActuel('')
            setNouveau('')
            setConfirmation('')
        }
    }

    return (
        <div className="space-y-5 py-4">

            {/* ── Infos boutique ──────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                    <div className="bg-[#1a56db]/10 p-2 rounded-lg">
                        <Building2 className="w-5 h-5 text-[#1a56db]" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Ma boutique</h2>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-400 mb-1">Boutique</p>
                        <p className="text-sm font-bold text-gray-800 truncate">{boutique.nom}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-400 mb-1">Plan actuel</p>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${planConfig.bg} ${planConfig.couleur}`}>
                            {planConfig.label}
                        </span>
                    </div>
                    <div className={`p-3 rounded-xl ${
                        joursRestants !== null && joursRestants <= 7
                            ? 'bg-red-50'
                            : 'bg-gray-50'
                    }`}>
                        <p className="text-xs text-gray-400 mb-1">Expiration</p>
                        {boutique.plan_expire_le ? (
                            <>
                                <p className={`text-xs font-bold ${
                                    joursRestants !== null && joursRestants <= 7
                                        ? 'text-red-600'
                                        : 'text-gray-700'
                                }`}>
                                    {joursRestants === 0
                                        ? 'Expiré !'
                                        : `J-${joursRestants}`
                                    }
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {formatDate(boutique.plan_expire_le)}
                                </p>
                            </>
                        ) : (
                            <p className="text-xs text-gray-500">—</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Informations personnelles ───────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                    <div className="bg-[#1a56db]/10 p-2 rounded-lg">
                        <User className="w-5 h-5 text-[#1a56db]" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Informations personnelles</h2>
                </div>

                {msgNom && (
                    <div className={`flex items-center gap-2.5 p-3 rounded-xl text-sm ${
                        msgNom.type === 'succes'
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                        {msgNom.type === 'succes'
                            ? <CheckCircle className="w-4 h-4 shrink-0" />
                            : <AlertCircle className="w-4 h-4 shrink-0" />
                        }
                        {msgNom.texte}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Nom complet</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={nom}
                                onChange={e => setNom(e.target.value)}
                                disabled={nomEnCours}
                                className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 focus:border-[#1a56db]/40 disabled:opacity-50"
                            />
                            <button
                                onClick={handleSauvegarderNom}
                                disabled={nomEnCours || !nom.trim() || nom === utilisateur.nom_complet}
                                className="px-4 py-2.5 bg-[#1a56db] text-white text-sm font-bold rounded-xl hover:bg-[#1648c0] disabled:opacity-40 transition-all shrink-0"
                            >
                                {nomEnCours
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : 'Sauvegarder'
                                }
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Identifiant de connexion</label>
                        <div className="px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 font-mono">
                            {utilisateur.identifiant}
                        </div>
                        <p className="text-xs text-gray-400">Non modifiable</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Rôle</label>
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl">
                            <Shield className="w-4 h-4 text-[#1a56db]" />
                            <span className="text-sm text-gray-600 font-medium capitalize">
                                {utilisateur.role.replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Membre depuis</label>
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                                {formatDate(utilisateur.created_at)}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">ID public</label>
                        <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 font-mono">
                            {utilisateur.public_id}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Changement de mot de passe ──────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                    <div className="bg-amber-100 p-2 rounded-lg">
                        <Lock className="w-5 h-5 text-amber-600" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Changer mon mot de passe</h2>
                </div>

                {msgMdp && (
                    <div className={`flex items-center gap-2.5 p-3.5 rounded-xl text-sm ${
                        msgMdp.type === 'succes'
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                        {msgMdp.type === 'succes'
                            ? <CheckCircle className="w-4 h-4 shrink-0" />
                            : <AlertCircle className="w-4 h-4 shrink-0" />
                        }
                        {msgMdp.texte}
                    </div>
                )}

                <div className="space-y-3">

                    {/* Mot de passe actuel */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Mot de passe actuel <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={voirActuel ? 'text' : 'password'}
                                value={actuel}
                                onChange={e => setActuel(e.target.value)}
                                disabled={mdpEnCours}
                                placeholder="Votre mot de passe actuel"
                                className="w-full px-3 py-2.5 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 disabled:opacity-50"
                            />
                            <button type="button"
                                    onClick={() => setVoirActuel(!voirActuel)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {voirActuel
                                    ? <EyeOff className="w-4 h-4" />
                                    : <Eye className="w-4 h-4" />
                                }
                            </button>
                        </div>
                    </div>

                    {/* Nouveau mot de passe */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Nouveau mot de passe <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={voirNouveau ? 'text' : 'password'}
                                value={nouveau}
                                onChange={e => setNouveau(e.target.value)}
                                disabled={mdpEnCours}
                                placeholder="Au moins 6 caractères"
                                className="w-full px-3 py-2.5 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 disabled:opacity-50"
                            />
                            <button type="button"
                                    onClick={() => setVoirNouveau(!voirNouveau)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {voirNouveau
                                    ? <EyeOff className="w-4 h-4" />
                                    : <Eye className="w-4 h-4" />
                                }
                            </button>
                        </div>

                        {/* Indicateur de force */}
                        {nouveau.length > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                                {[1,2,3,4].map(n => (
                                    <div key={n} className={`h-1 flex-1 rounded-full transition-all ${
                                        nouveau.length >= n * 2
                                            ? nouveau.length >= 10
                                                ? 'bg-green-500'
                                                : nouveau.length >= 6
                                                    ? 'bg-amber-400'
                                                    : 'bg-red-400'
                                            : 'bg-gray-200'
                                    }`} />
                                ))}
                                <span className={`text-xs font-medium ${
                                    nouveau.length >= 10 ? 'text-green-600'
                                        : nouveau.length >= 6 ? 'text-amber-600'
                                            : 'text-red-500'
                                }`}>
                                    {nouveau.length >= 10 ? 'Fort'
                                        : nouveau.length >= 6 ? 'Moyen'
                                            : 'Faible'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Confirmation */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Confirmer le nouveau mot de passe <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={voirConfirm ? 'text' : 'password'}
                                value={confirmation}
                                onChange={e => setConfirmation(e.target.value)}
                                disabled={mdpEnCours}
                                placeholder="Répétez le nouveau mot de passe"
                                className={`w-full px-3 py-2.5 pr-10 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors ${
                                    confirmation.length > 0
                                        ? confirmation === nouveau
                                            ? 'border-green-300 focus:ring-green-400/30'
                                            : 'border-red-300 focus:ring-red-400/30'
                                        : 'border-gray-200 focus:ring-[#1a56db]/30'
                                }`}
                            />
                            <button type="button"
                                    onClick={() => setVoirConfirm(!voirConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {voirConfirm
                                    ? <EyeOff className="w-4 h-4" />
                                    : <Eye className="w-4 h-4" />
                                }
                            </button>
                            {confirmation.length > 0 && confirmation === nouveau && (
                                <CheckCircle className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                            )}
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleChangerMdp}
                    disabled={mdpEnCours || !actuel || !nouveau || !confirmation}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 font-bold text-white rounded-xl transition-all disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                    {mdpEnCours
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Mise à jour...</>
                        : <><Lock className="w-4 h-4" />Changer mon mot de passe</>
                    }
                </button>
            </div>

        </div>
    )
}