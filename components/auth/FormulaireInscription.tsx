'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { creerBoutiquePublic } from '@/actions/inscription'
import { Loader2, AlertCircle, AlertTriangle, CheckCircle, Store, User, Phone, Mail, Globe, PartyPopper } from 'lucide-react'

const PAYS = [
    'Bénin', 'Togo', 'Côte d\'Ivoire', 'Sénégal', 'Mali',
    'Burkina Faso', 'Niger', 'Ghana', 'Nigeria', 'Cameroun',
    'Gabon', 'Congo', 'RDC', 'France', 'Maroc', 'Autre',
]

const DEVISES = ['FCFA', 'XOF', 'GHS', 'NGN', 'EUR', 'USD', 'MAD', 'XAF']

interface Etat {
    erreur?:      string
    succes?:      boolean
    identifiant?: string
    motDePasse?:  string
    shopPublicId?: string
}

const inputClass = `
    w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50
    transition-colors disabled:opacity-50
`

export default function FormulaireInscription() {
    const router = useRouter()
    const [etape, setEtape]         = useState<1 | 2>(1)
    const [enAttente, setEnAttente] = useState(false)
    const [etat, setEtat]           = useState<Etat>({})

    // Étape 1 — Boutique
    const [nomBoutique, setNomBoutique] = useState('')
    const [pays, setPays]               = useState('Bénin')
    const [ville, setVille]             = useState('')
    const [telephone, setTelephone]     = useState('')
    const [email, setEmail]             = useState('')
    const [devise, setDevise]           = useState('FCFA')

    // Étape 2 — Propriétaire
    const [nomProprietaire, setNomProprietaire] = useState('')

    async function handleSoumettre() {
        if (!nomBoutique.trim())     { setEtat({ erreur: 'Le nom de la boutique est obligatoire.' });  return }
        if (!telephone.trim())       { setEtat({ erreur: 'Le numéro de téléphone est obligatoire.' }); return }
        if (!nomProprietaire.trim()) { setEtat({ erreur: 'Votre nom complet est obligatoire.' });       return }

        setEnAttente(true)
        setEtat({})

        const formData = new FormData()
        formData.set('nomBoutique',    nomBoutique.trim())
        formData.set('pays',           pays)
        formData.set('ville',          ville.trim())
        formData.set('telephone',      telephone.trim())
        formData.set('email',          email.trim())
        formData.set('devise',         devise)
        formData.set('nomProprietaire', nomProprietaire.trim())

        const res = await creerBoutiquePublic(formData)
        setEnAttente(false)

        if (res?.erreur) {
            setEtat({ erreur: res.erreur })
            return
        }

        setEtat({
            succes:       true,
            identifiant:  res.identifiant,
            motDePasse:   res.motDePasse,
            shopPublicId: (res as any).shopPublicId,
        })
    }

    // ── Écran de succès ────────────────────────────────────────
    if (etat.succes) {
        return (
            <div className="space-y-4">

                {/* Confirmation */}
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
                    <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-green-800">Boutique créée avec succès !</p>
                        <p className="text-xs text-green-600 mt-0.5">
                            Votre période d'essai de 30 jours démarre maintenant.
                        </p>
                    </div>
                </div>

                {/* Credentials */}
                <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl space-y-3">
                    <p className="text-sm font-bold text-blue-800">🔑 Vos identifiants de connexion</p>
                    <p className="text-xs text-blue-600">
                        Notez ces informations maintenant.
                        {email ? ' Vous recevrez aussi un email de confirmation.' : ' Aucun email fourni — conservez ces informations précieusement.'}
                    </p>

                    <div className="space-y-2">

                        {/* ID Boutique — mis en évidence, obligatoire à la connexion */}
                        <div
                            className="flex items-center justify-between p-3.5 rounded-xl"
                            style={{ background: 'linear-gradient(135deg, #15335a, #0f2742)' }}
                        >
                            <div>
                                <p className="text-xs font-bold text-white/80 uppercase tracking-wider">
                                    ID Boutique
                                </p>
                                <p className="text-xs text-white/60 mt-0.5">
                                    Obligatoire à la connexion
                                </p>
                            </div>
                            <span className="text-xl font-black text-white font-mono tracking-widest">
                                {etat.shopPublicId}
                            </span>
                        </div>

                        {/* Identifiant */}
                        <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-blue-200">
                            <span className="text-xs font-semibold text-gray-500">Identifiant</span>
                            <span className="text-sm font-black text-gray-800 font-mono">
                                {etat.identifiant}
                            </span>
                        </div>

                        {/* Mot de passe */}
                        <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-blue-200">
                            <span className="text-xs font-semibold text-gray-500">Mot de passe</span>
                            <span className="text-sm font-black text-gray-800 font-mono">
                                {etat.motDePasse}
                            </span>
                        </div>

                    </div>
                </div>

                {/* Avertissement */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
                    <p className="text-xs text-amber-700">
                        Ces informations ne seront plus affichées après cette page.
                        Notez-les ou faites une capture d'écran avant de continuer.
                        Changez votre mot de passe dès votre première connexion.
                    </p>
                </div>

                {/* Bouton connexion */}
                <button
                    onClick={() => router.push('/login')}
                    className="w-full py-3.5 font-bold text-white rounded-xl text-sm transition-all"
                    style={{ background: 'linear-gradient(135deg, #15335a, #0f2742)' }}
                >
                    Me connecter maintenant →
                </button>
            </div>
        )
    }

    // ── Formulaire ─────────────────────────────────────────────
    return (
        <div className="space-y-5">

            {etat.erreur && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {etat.erreur}
                </div>
            )}

            {/* Indicateur d'étapes */}
            <div className="flex items-center gap-3 mb-2">
                {[1, 2].map(n => (
                    <div key={n} className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                            etape === n
                                ? 'bg-blue-600 text-white'
                                : n < etape
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-400'
                        }`}>
                            {n < etape ? '✓' : n}
                        </div>
                        <span className={`text-xs font-medium ${
                            etape === n ? 'text-blue-600' : 'text-gray-400'
                        }`}>
                            {n === 1 ? 'Votre boutique' : 'Votre profil'}
                        </span>
                        {n < 2 && <div className="w-8 h-px bg-gray-200" />}
                    </div>
                ))}
            </div>

            {/* ── ÉTAPE 1 — Infos boutique ──────────────────── */}
            {etape === 1 && (
                <div className="space-y-4">

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-blue-600" />
                            Nom de la boutique <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={nomBoutique}
                               onChange={e => setNomBoutique(e.target.value)}
                               placeholder="Ex: Boutique Kofi & Fils"
                               className={inputClass} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">Pays</label>
                            <select value={pays} onChange={e => setPays(e.target.value)}
                                    className={inputClass}>
                                {PAYS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">Ville</label>
                            <input type="text" value={ville}
                                   onChange={e => setVille(e.target.value)}
                                   placeholder="Ex: Cotonou"
                                   className={inputClass} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-blue-600" />
                            Téléphone <span className="text-red-500">*</span>
                        </label>
                        <input type="tel" value={telephone}
                               onChange={e => setTelephone(e.target.value)}
                               placeholder="+229 97 00 00 00"
                               className={inputClass} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-blue-600" />
                            Email
                            <span className="text-xs text-gray-400 font-normal ml-1">
                                (recommandé — pour recevoir vos identifiants)
                            </span>
                        </label>
                        <input type="email" value={email}
                               onChange={e => setEmail(e.target.value)}
                               placeholder="votre@email.com"
                               className={inputClass} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-blue-600" />
                            Devise principale
                        </label>
                        <select value={devise} onChange={e => setDevise(e.target.value)}
                                className={inputClass}>
                            {DEVISES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={() => {
                            if (!nomBoutique.trim() || !telephone.trim()) {
                                setEtat({ erreur: 'Le nom et le téléphone sont obligatoires.' })
                                return
                            }
                            setEtat({})
                            setEtape(2)
                        }}
                        className="w-full py-3.5 font-bold text-white rounded-xl text-sm transition-all"
                        style={{ background: 'linear-gradient(135deg, #15335a, #0f2742)' }}
                    >
                        Continuer →
                    </button>
                </div>
            )}

            {/* ── ÉTAPE 2 — Profil propriétaire ────────────── */}
            {etape === 2 && (
                <div className="space-y-4">

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-xs font-medium text-blue-700">
                            ✓ Boutique : <strong>{nomBoutique}</strong>
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            Votre nom complet <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={nomProprietaire}
                               onChange={e => setNomProprietaire(e.target.value)}
                               placeholder="Prénom et Nom"
                               autoFocus
                               className={inputClass} />
                        <p className="text-xs text-gray-400">
                            Ce nom sera celui du compte SuperAdmin de votre boutique.
                        </p>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                        <p className="text-xs text-amber-700 font-bold flex items-center gap-1.5">
                            <PartyPopper className="w-3.5 h-3.5" /> Plan Starter — 30 jours gratuits
                        </p>
                        <p className="text-xs text-amber-600">
                            Votre boutique démarrera sur le plan Starter. Après 30 jours,
                            contactez-nous pour continuer avec le plan adapté à votre activité.
                        </p>
                    </div>

                    <p className="text-xs text-gray-400 text-center">
                        En créant votre boutique, vous acceptez nos{' '}
                        <a href="#" className="text-blue-600 hover:underline">
                            conditions d'utilisation
                        </a>.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setEtape(1)}
                            disabled={enAttente}
                            className="flex-1 py-3.5 font-bold text-gray-600 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-all disabled:opacity-50"
                        >
                            ← Retour
                        </button>
                        <button
                            onClick={handleSoumettre}
                            disabled={enAttente || !nomProprietaire.trim()}
                            className="flex-[2] py-3.5 font-bold text-white rounded-xl text-sm transition-all disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
                        >
                            {enAttente
                                ? <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Création en cours...
                                  </span>
                                : '✓ Créer ma boutique gratuitement'
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}