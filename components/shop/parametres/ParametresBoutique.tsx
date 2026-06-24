'use client'

import { useState, useRef } from 'react'
import { modifierParametresBoutique, uploadLogoBoutique } from '@/actions/shops'
import {
    Store, Phone, Mail, Globe, MapPin, FileText,
    Image as ImageIcon, Percent, Receipt, Building2, Upload,
    CheckCircle, AlertCircle, Loader2, Save,
    CreditCard, MessageSquare, Info,
} from 'lucide-react'

interface Props { boutique: any }

const DEVISES = ['FCFA', 'XOF', 'GHS', 'NGN', 'EUR', 'USD', 'MAD', 'XAF']

const PAYS = [
    'Bénin', 'Togo', 'Côte d\'Ivoire', 'Sénégal', 'Mali',
    'Burkina Faso', 'Niger', 'Ghana', 'Nigeria', 'Cameroun',
    'Gabon', 'Congo', 'RDC', 'Côte d\'Ivoire', 'France', 'Maroc', 'Autre',
]

interface EtatAction { erreur?: string; succes?: boolean }

export default function ParametresBoutique({ boutique }: Props) {
    // ── États formulaire ──────────────────────────────────────────
    const [nom,          setNom]          = useState(boutique.nom ?? '')
    const [adresse,      setAdresse]      = useState(boutique.adresse ?? '')
    const [ville,        setVille]        = useState(boutique.ville ?? '')
    const [pays,         setPays]         = useState(boutique.pays ?? 'Bénin')
    const [telephone1,   setTelephone1]   = useState(boutique.telephone_1 ?? '')
    const [telephone2,   setTelephone2]   = useState(boutique.telephone_2 ?? '')
    const [email,        setEmail]        = useState(boutique.email ?? '')
    const [siteWeb,      setSiteWeb]      = useState(boutique.site_web ?? '')
    const [ifu,          setIfu]          = useState(boutique.ifu ?? '')
    const [rccm,         setRccm]         = useState(boutique.rccm ?? '')
    const [devise,       setDevise]       = useState(boutique.devise ?? 'FCFA')
    const [remiseMax,    setRemiseMax]    = useState(boutique.remise_max_pct ?? 15)
    const [msgFacture,   setMsgFacture]   = useState(boutique.message_pied_facture ?? '')
    const [msgRecu,      setMsgRecu]      = useState(boutique.message_recu_thermique ?? '')

    // ── États UI ──────────────────────────────────────────────────
    const [enAttente,    setEnAttente]    = useState(false)
    const [etat,         setEtat]         = useState<EtatAction>({})
    const [logoUrl,      setLogoUrl]      = useState<string>(boutique.logo_url ?? '')
    const [uploadEnCours, setUploadEnCours] = useState(false)
    const [etatLogo,     setEtatLogo]    = useState<EtatAction>({})
    const [onglet,       setOnglet]       = useState<'infos'|'commerce'|'messages'|'logo'>('infos')

    const inputLogoRef = useRef<HTMLInputElement>(null)

    // ── Sauvegarder paramètres ────────────────────────────────────
    async function handleSauvegarder() {
        setEnAttente(true)
        setEtat({})
        const formData = new FormData()
        formData.set('nom',                    nom)
        formData.set('adresse',               adresse)
        formData.set('ville',                 ville)
        formData.set('pays',                  pays)
        formData.set('telephone_1',           telephone1)
        formData.set('telephone_2',           telephone2)
        formData.set('email',                 email)
        formData.set('site_web',              siteWeb)
        formData.set('ifu',                   ifu)
        formData.set('rccm',                  rccm)
        formData.set('devise',                devise)
        formData.set('remise_max_pct',        String(remiseMax))
        formData.set('message_pied_facture',  msgFacture)
        formData.set('message_recu_thermique', msgRecu)

        const res = await modifierParametresBoutique(formData)
        setEnAttente(false)
        if (res?.erreur) setEtat({ erreur: res.erreur })
        else setEtat({ succes: true })
    }

    // ── Upload logo ───────────────────────────────────────────────
    async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadEnCours(true)
        setEtatLogo({})

        // ✅ UTILISE UNE ROUTE API au lieu de la Server Action
        // Les Server Actions ne supportent pas bien les gros fichiers binaires
        const formData = new FormData()
        formData.append('logo', file)

        try {
            const response = await fetch('/api/v1/upload/logo', {
                method: 'POST',
                body:   formData,
                // Ne pas définir Content-Type — le navigateur le fait automatiquement avec le boundary
            })

            const data = await response.json()

            if (!response.ok || data.erreur) {
                setEtatLogo({ erreur: data.erreur ?? 'Erreur lors de l\'upload.' })
            } else {
                setLogoUrl(data.logoUrl)
                setEtatLogo({ succes: true })
            }
        } catch {
            setEtatLogo({ erreur: 'Erreur réseau. Vérifiez votre connexion et réessayez.' })
        } finally {
            setUploadEnCours(false)
            // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
            if (inputLogoRef.current) inputLogoRef.current.value = ''
        }
    }

    // ── Onglets ───────────────────────────────────────────────────
    const ONGLETS = [
        { key: 'infos',    label: 'Identité',    icone: Store      },
        { key: 'commerce', label: 'Commerce',    icone: Percent    },
        { key: 'messages', label: 'Messages',    icone: MessageSquare },
        { key: 'logo',     label: 'Logo',        icone: ImageIcon      },
    ] as const

    return (
        <div className="space-y-5 py-2">

            {/* Onglets */}
            <div className="bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm">
                <div className="flex gap-1">
                    {ONGLETS.map(o => {
                        const Icone  = o.icone
                        const actif  = onglet === o.key
                        return (
                            <button key={o.key}
                                    onClick={() => setOnglet(o.key)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                        actif
                                            ? 'bg-[#1a56db] text-white shadow-md shadow-[#1a56db]/30'
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                    }`}>
                                <Icone className="w-4 h-4" />
                                {o.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── ONGLET IDENTITÉ ────────────────────────────────────── */}
            {onglet === 'infos' && (
                <div className="space-y-5">

                    {/* Infos principales */}
                    <Section
                        titre="Informations générales"
                        icone={Store}
                        description="Nom, coordonnées et localisation de votre boutique"
                    >
                        <Champ label="Nom de la boutique" requis>
                            <input type="text" value={nom} onChange={e => setNom(e.target.value)}
                                   placeholder="Ex: Boutique Kofi & Fils"
                                   className={inputClass} />
                        </Champ>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Champ label="Téléphone principal" requis>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="tel" value={telephone1}
                                           onChange={e => setTelephone1(e.target.value)}
                                           placeholder="+229 97 00 00 00"
                                           className={inputClass + ' pl-9'} />
                                </div>
                            </Champ>
                            <Champ label="Téléphone secondaire">
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="tel" value={telephone2}
                                           onChange={e => setTelephone2(e.target.value)}
                                           placeholder="+229 96 00 00 00"
                                           className={inputClass + ' pl-9'} />
                                </div>
                            </Champ>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Champ label="Email">
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="email" value={email}
                                           onChange={e => setEmail(e.target.value)}
                                           placeholder="boutique@email.com"
                                           className={inputClass + ' pl-9'} />
                                </div>
                            </Champ>
                            <Champ label="Site web">
                                <div className="relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="url" value={siteWeb}
                                           onChange={e => setSiteWeb(e.target.value)}
                                           placeholder="https://..."
                                           className={inputClass + ' pl-9'} />
                                </div>
                            </Champ>
                        </div>

                        <Champ label="Adresse">
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" value={adresse}
                                       onChange={e => setAdresse(e.target.value)}
                                       placeholder="Adresse complète"
                                       className={inputClass + ' pl-9'} />
                            </div>
                        </Champ>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Champ label="Ville">
                                <input type="text" value={ville}
                                       onChange={e => setVille(e.target.value)}
                                       placeholder="Ex: Cotonou"
                                       className={inputClass} />
                            </Champ>
                            <Champ label="Pays">
                                <select value={pays} onChange={e => setPays(e.target.value)}
                                        className={inputClass}>
                                    {PAYS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </Champ>
                        </div>
                    </Section>

                    {/* Infos légales */}
                    <Section
                        titre="Informations légales"
                        icone={Building2}
                        description="IFU et RCCM — apparaissent sur les factures entreprise"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Champ label="Numéro IFU">
                                <input type="text" value={ifu}
                                       onChange={e => setIfu(e.target.value)}
                                       placeholder="Identifiant Fiscal Unique"
                                       className={inputClass} />
                            </Champ>
                            <Champ label="Numéro RCCM">
                                <input type="text" value={rccm}
                                       onChange={e => setRccm(e.target.value)}
                                       placeholder="Registre Commerce"
                                       className={inputClass} />
                            </Champ>
                        </div>
                    </Section>
                </div>
            )}

            {/* ── ONGLET COMMERCE ────────────────────────────────────── */}
            {onglet === 'commerce' && (
                <div className="space-y-5">

                    <Section
                        titre="Devise et tarification"
                        icone={CreditCard}
                        description="Devise utilisée dans toute l'application"
                    >
                        <Champ label="Devise principale" requis>
                            <select value={devise} onChange={e => setDevise(e.target.value)}
                                    className={inputClass}>
                                {DEVISES.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </Champ>
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex gap-2.5">
                            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700">
                                La devise est affichée partout dans l'application : POS, factures, rapports.
                                Attention : changer la devise ne convertit pas les prix existants.
                            </p>
                        </div>
                    </Section>

                    <Section
                        titre="Politique de remise"
                        icone={Percent}
                        description="Plafond de remise autorisé par vos vendeurs"
                    >
                        <Champ label="Remise maximum autorisée (%)">
                            <div className="flex items-center gap-3">
                                <input type="range" min="0" max="50" step="0.5"
                                       value={remiseMax}
                                       onChange={e => setRemiseMax(parseFloat(e.target.value))}
                                       className="flex-1 accent-[#1a56db]" />
                                <div className="w-20 px-3 py-2 bg-[#1a56db] text-white text-center font-black rounded-xl text-sm shrink-0">
                                    {remiseMax}%
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5">
                                Au-delà de ce seuil, la vente est bloquée. Applicable sur tout le POS.
                            </p>
                        </Champ>

                        <div className={`p-4 rounded-xl border-2 ${
                            remiseMax <= 10
                                ? 'bg-green-50 border-green-200'
                                : remiseMax <= 20
                                    ? 'bg-yellow-50 border-yellow-200'
                                    : 'bg-red-50 border-red-200'
                        }`}>
                            <p className={`text-sm font-bold ${
                                remiseMax <= 10 ? 'text-green-700' : remiseMax <= 20 ? 'text-yellow-700' : 'text-red-700'
                            }`}>
                                {remiseMax <= 10
                                    ? '✅ Politique conservative — forte protection de la marge'
                                    : remiseMax <= 20
                                        ? '⚠️ Politique modérée — marge correctement protégée'
                                        : '🔴 Politique libérale — attention à la marge brute'
                                }
                            </p>
                            <p className={`text-xs mt-1 ${
                                remiseMax <= 10 ? 'text-green-600' : remiseMax <= 20 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                                Vos vendeurs peuvent accorder jusqu'à <strong>{remiseMax}%</strong> de remise par vente.
                            </p>
                        </div>
                    </Section>

                </div>
            )}

            {/* ── ONGLET MESSAGES ────────────────────────────────────── */}
            {onglet === 'messages' && (
                <div className="space-y-5">

                    <Section
                        titre="Message reçu thermique"
                        icone={Receipt}
                        description="Apparaît en bas de chaque reçu imprimé au POS (80mm)"
                    >
                        <Champ label="Message de remerciement">
              <textarea
                  value={msgRecu}
                  onChange={e => setMsgRecu(e.target.value)}
                  rows={3}
                  maxLength={120}
                  placeholder="Ex: Merci pour votre achat ! Revenez nous voir bientôt 😊"
                  className={inputClass + ' resize-none'} />
                            <div className="flex justify-between mt-1">
                                <p className="text-xs text-gray-400">
                                    Si vide, le message par défaut sera utilisé : "Merci pour votre achat !"
                                </p>
                                <p className="text-xs text-gray-400">{msgRecu.length}/120</p>
                            </div>
                        </Champ>

                        {/* Aperçu reçu */}
                        <div className="p-4 bg-white border-2 border-dashed border-gray-300 rounded-xl font-mono text-xs text-gray-600 text-center space-y-1">
                            <p className="font-bold text-gray-800">{boutique.nom}</p>
                            <p>Tél : {boutique.telephone_1 ?? '—'}</p>
                            <p className="border-t border-dashed border-gray-300 pt-1 mt-2">
                                *** REÇU ***
                            </p>
                            <p className="text-gray-400">... articles ...</p>
                            <p className="border-t border-dashed border-gray-300 pt-1 mt-1 text-[#1a56db] font-bold">
                                {msgRecu || 'Merci pour votre achat !'}
                            </p>
                            <p className="text-gray-400">*** Conservez ce reçu ***</p>
                        </div>
                    </Section>

                    <Section
                        titre="Pied de page factures A4"
                        icone={FileText}
                        description="Apparaît en bas des factures entreprise (A4)"
                    >
                        <Champ label="Message pied de facture">
              <textarea
                  value={msgFacture}
                  onChange={e => setMsgFacture(e.target.value)}
                  rows={3}
                  maxLength={200}
                  placeholder="Ex: Merci de votre confiance. Tout litige doit être signalé dans les 48h suivant la réception de la marchandise."
                  className={inputClass + ' resize-none'} />
                            <div className="flex justify-between mt-1">
                                <p className="text-xs text-gray-400">
                                    Visible par vos clients sur chaque facture A4.
                                </p>
                                <p className="text-xs text-gray-400">{msgFacture.length}/200</p>
                            </div>
                        </Champ>

                        {/* Aperçu facture */}
                        <div className="p-4 bg-white border-2 border-dashed border-gray-300 rounded-xl text-xs space-y-2">
                            <div className="flex justify-between text-gray-400">
                                <div>
                                    <p className="font-bold text-gray-700">{boutique.nom}</p>
                                    <p>{boutique.telephone_1}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-700">FACTURE</p>
                                    <p>FACT-00001</p>
                                </div>
                            </div>
                            <div className="border-t border-gray-200 my-2" />
                            <p className="text-gray-300 text-center">... lignes de facture ...</p>
                            <div className="border-t border-gray-200 my-2" />
                            <p className="text-[#1a56db] italic text-center">
                                {msgFacture || 'Aucun message pied de page configuré.'}
                            </p>
                        </div>
                    </Section>

                </div>
            )}

            {/* ── ONGLET LOGO ────────────────────────────────────────── */}
            {onglet === 'logo' && (
                <Section
                    titre="Logo de la boutique"
                    icone={ImageIcon}
                    description="Affiché sur les factures A4. Format recommandé : PNG transparent, 200×200px minimum."
                >
                    {/* Logo actuel */}
                    <div className="flex items-start gap-5">
                        <div className="shrink-0">
                            {logoUrl ? (
                                <div className="w-32 h-32 rounded-2xl border-2 border-[#1a56db]/30 overflow-hidden bg-gray-50 flex items-center justify-center">
                                    <img
                                        src={logoUrl}
                                        alt="Logo boutique"
                                        className="w-full h-full object-contain p-2"
                                    />
                                </div>
                            ) : (
                                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2">
                                    <Store className="w-10 h-10 text-gray-300" />
                                    <p className="text-xs text-gray-400 text-center leading-tight">
                                        Pas de logo
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 space-y-4">
                            {etatLogo.erreur && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {etatLogo.erreur}
                                </div>
                            )}
                            {etatLogo.succes && (
                                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                                    <CheckCircle className="w-4 h-4 shrink-0" />
                                    Logo mis à jour avec succès !
                                </div>
                            )}

                            <div className="space-y-2">
                                <p className="text-sm font-medium text-gray-700">Charger un nouveau logo</p>
                                <ul className="text-xs text-gray-400 space-y-0.5 list-disc list-inside">
                                    <li>Formats acceptés : JPG, PNG, WEBP, SVG</li>
                                    <li>Taille maximale : 2 Mo</li>
                                    <li>Dimension recommandée : 200×200px minimum</li>
                                    <li>Fond transparent recommandé (PNG)</li>
                                </ul>
                            </div>

                            <input
                                ref={inputLogoRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                onChange={handleUploadLogo}
                                className="hidden"
                            />

                            <button
                                type="button"
                                onClick={() => inputLogoRef.current?.click()}
                                disabled={uploadEnCours}
                                className="flex items-center gap-2.5 px-5 py-3 bg-[#1a56db] text-white font-bold text-sm rounded-xl hover:bg-[#1648c0] transition-all hover:shadow-lg hover:shadow-[#1a56db]/30 disabled:opacity-50"
                            >
                                {uploadEnCours
                                    ? <><Loader2 className="w-4 h-4 animate-spin" />Upload en cours...</>
                                    : <><Upload className="w-4 h-4" />Choisir un logo</>
                                }
                            </button>
                        </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2.5">
                        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                            Le logo apparaît uniquement sur les <strong>factures A4</strong> envoyées à vos
                            clients entreprise. Il n'apparaît pas sur les reçus thermiques 80mm.
                            Pour voir le résultat, téléchargez une facture PDF depuis la section Facturation.
                        </p>
                    </div>
                </Section>
            )}

            {/* ── BOUTON SAUVEGARDER (visible sur tous les onglets sauf logo) ── */}
            {onglet !== 'logo' && (
                <div className="space-y-3">
                    {etat.erreur && (
                        <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {etat.erreur}
                        </div>
                    )}
                    {etat.succes && (
                        <div className="flex items-center gap-2.5 p-3.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            Paramètres enregistrés avec succès !
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleSauvegarder}
                        disabled={enAttente}
                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-[#1a56db] text-white font-bold text-base rounded-2xl hover:bg-[#1648c0] transition-all hover:shadow-lg hover:shadow-[#1a56db]/30 disabled:opacity-60"
                    >
                        {enAttente
                            ? <><Loader2 className="w-5 h-5 animate-spin" />Enregistrement...</>
                            : <><Save className="w-5 h-5" />Enregistrer les paramètres</>
                        }
                    </button>
                </div>
            )}

        </div>
    )
}

// ── Composants utilitaires ─────────────────────────────────────
const inputClass = `
  w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm
  focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 focus:border-[#1a56db]/40
  transition-colors
`

function Section({
                     titre, icone: Icone, description, children,
                 }: {
    titre:       string
    icone:       React.ElementType
    description: string
    children:    React.ReactNode
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="bg-[#1a56db]/10 p-2 rounded-lg">
                        <Icone className="w-5 h-5 text-[#1a56db]" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">{titre}</h2>
                </div>
                <p className="text-xs text-gray-400 ml-10">{description}</p>
            </div>
            {children}
        </div>
    )
}

function Champ({
                   label, requis, children,
               }: {
    label:    string
    requis?:  boolean
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
                {label}
                {requis && <span className="text-red-500 ml-1">*</span>}
            </label>
            {children}
        </div>
    )
}