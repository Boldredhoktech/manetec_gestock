'use client'

// ═══════════════════════════════════════════════════════════════
// Formulaires de la trésorerie (mig 041) : nouveau compte, modification,
// virement, retrait / apport, rapprochement, annulations.
// ═══════════════════════════════════════════════════════════════

import { useActionState, useEffect, useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Modale from '@/components/ui/Modale'
import {
    creerCompte, modifierCompte, changerEtatCompte, effectuerVirement, annulerVirement,
    enregistrerOperationProprietaire, annulerOperationProprietaire, enregistrerRapprochement,
} from '@/actions/tresorerie'
import { LIBELLES_TYPE, OPERATEURS_MM, formatF, type CompteChoix } from '@/lib/tresorerie/comptes'

type Etat = { erreur?: string; succes?: boolean; message?: string }
const ETAT0: Etat = {}

const champ = 'w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'
const etiquette = 'text-sm font-medium text-foreground'
const aujourdhui = () => new Date().toISOString().split('T')[0]

function Message({ etat }: { etat: Etat }) {
    if (etat.erreur) return (
        <div role="alert" className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2.5 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{etat.erreur}</span>
        </div>
    )
    if (etat.succes) return (
        <div role="status" className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2.5 text-sm">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /><span>{etat.message ?? 'Enregistré.'}</span>
        </div>
    )
    return null
}

function useFormulaire(action: (f: FormData) => Promise<{ erreur?: string; succes?: boolean; message?: string }>) {
    const router = useRouter()
    return useActionState(async (_p: Etat, f: FormData): Promise<Etat> => {
        const r = await action(f)
        if ('erreur' in r && r.erreur) return { erreur: r.erreur }
        router.refresh()
        return { succes: true, message: r.message }
    }, ETAT0)
}



/** Affichage dans une modale (nouveau design) : `ouvert` / `onFermer`. */
export type EnModale = { onFermer: () => void }

/**
 * Le même formulaire, dans la page ou dans une modale. En modale, les
 * boutons vont dans le pied (toujours visibles) et la modale se ferme
 * dès que l'opération est enregistrée.
 */
function Cadre({ modale, titre, description, idForm, enAttente, libelle, etat, taille = 'md', children }: {
    modale?: EnModale; titre: string; description?: string; idForm: string; enAttente: boolean
    libelle: string; etat: Etat; taille?: 'sm' | 'md' | 'lg'; children: React.ReactNode
}) {
    useEffect(() => { if (modale && etat.succes) modale.onFermer() }, [etat, modale])
    const soumettre = (
        <Button type="submit" form={idForm} disabled={enAttente} className={modale ? '' : 'w-full'}>
            {enAttente ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</> : libelle}
        </Button>
    )
    if (!modale) return <div className="space-y-4">{children}{soumettre}</div>
    return (
        <Modale ouvert onFermer={modale.onFermer} titre={titre} description={description} taille={taille}
                pied={<><Button type="button" variant="outline" onClick={modale.onFermer}>Annuler</Button>{soumettre}</>}>
            {children}
        </Modale>
    )
}

const libelleCompte = (c: CompteChoix) => `${c.nom}${c.solde !== undefined ? ` — ${formatF(c.solde)}` : ''}`

// ── Nouveau compte ─────────────────────────────────────────────
export function FormulaireNouveauCompte({ banques, modale }: { modale?: EnModale; banques: CompteChoix[] }) {
    const idForm = useId()
    const [etat, action, enAttente] = useFormulaire(creerCompte)
    const [type, setType] = useState<'mobile_money' | 'banque' | 'tpe'>('mobile_money')

    return (
        <Cadre modale={modale} titre="Nouveau compte de trésorerie" description="Banque, Mobile Money ou TPE. Les caisses POS ont leur propre bouton." idForm={idForm} enAttente={enAttente} libelle={'Créer le compte'} etat={etat}>
        <form id={idForm} action={action} className="space-y-4">
            <Message etat={etat} />
            <div className="space-y-1.5">
                <span className={etiquette}>Type de compte</span>
                <div role="group" className="flex flex-wrap gap-2">
                    {(['mobile_money', 'banque', 'tpe'] as const).map(t => (
                        <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium ${type === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'}`}>
                            {LIBELLES_TYPE[t]}
                        </button>
                    ))}
                </div>
                <input type="hidden" name="type" value={type} />
                <p className="text-xs text-muted-foreground">Pour une caisse de vente, utilisez « Nouvelle caisse POS ».</p>
            </div>

            {type === 'mobile_money' && (
                <label className="block space-y-1.5"><span className={etiquette}>Opérateur *</span>
                    <select name="operateur" required className={champ} defaultValue="mtn">
                        {OPERATEURS_MM.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                    </select>
                </label>
            )}
            {type === 'banque' && (
                <label className="block space-y-1.5"><span className={etiquette}>Banque</span>
                    <input name="banque" className={champ} placeholder="Ex. Ecobank, BOA, Orabank" />
                </label>
            )}

            <label className="block space-y-1.5"><span className={etiquette}>Nom du compte *</span>
                <input name="nom" required minLength={2} maxLength={80} className={champ}
                       placeholder={type === 'mobile_money' ? 'Ex. MTN MoMo boutique' : type === 'banque' ? 'Ex. Compte courant Ecobank' : 'Ex. TPE comptoir'} />
            </label>

            {type !== 'tpe' && (
                <label className="block space-y-1.5">
                    <span className={etiquette}>{type === 'banque' ? 'N° de compte / IBAN *' : 'N° de téléphone marchand *'}</span>
                    <input name="numero" required className={champ} inputMode={type === 'mobile_money' ? 'tel' : 'text'} />
                </label>
            )}
            {type === 'tpe' && (
                <label className="block space-y-1.5"><span className={etiquette}>Reversé sur le compte bancaire</span>
                    <select name="compteReversementId" className={champ} defaultValue="">
                        <option value="">— À préciser plus tard —</option>
                        {banques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                    </select>
                </label>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1.5"><span className={etiquette}>Solde d&apos;ouverture</span>
                    <input name="soldeOuverture" inputMode="decimal" className={champ} placeholder="0" />
                </label>
                <label className="block space-y-1.5"><span className={etiquette}>À la date du</span>
                    <input name="dateOuverture" type="date" max={aujourdhui()} defaultValue={aujourdhui()} className={champ} />
                </label>
            </div>
        </form>
        </Cadre>
    )
}

// ── Modifier un compte ─────────────────────────────────────────
export function FormulaireModifierCompte({ compte, modale }: { modale?: EnModale;
    compte: { id: string; type: string; nom: string; operateur: string | null; banque: string | null;
              numero: string | null; solde_ouverture: number; date_ouverture: string; note: string | null }
}) {
    const idForm = useId()
    const [etat, action, enAttente] = useFormulaire(modifierCompte)
    return (
        <Cadre modale={modale} titre="Modifier le compte" description="Changer le solde ou la date d’ouverture est une correction tracée." idForm={idForm} enAttente={enAttente} libelle={'Enregistrer les modifications'} etat={etat}>
        <form id={idForm} action={action} className="space-y-4">
            <Message etat={etat} />
            <input type="hidden" name="id" value={compte.id} />
            <label className="block space-y-1.5"><span className={etiquette}>Nom</span>
                <input name="nom" required defaultValue={compte.nom} className={champ} />
            </label>
            {compte.type === 'mobile_money' && (
                <label className="block space-y-1.5"><span className={etiquette}>Opérateur</span>
                    <select name="operateur" defaultValue={compte.operateur ?? 'autre'} className={champ}>
                        {OPERATEURS_MM.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                    </select>
                </label>
            )}
            {compte.type === 'banque' && (
                <label className="block space-y-1.5"><span className={etiquette}>Banque</span>
                    <input name="banque" defaultValue={compte.banque ?? ''} className={champ} />
                </label>
            )}
            {compte.type !== 'caisse' && (
                <label className="block space-y-1.5"><span className={etiquette}>Numéro</span>
                    <input name="numero" defaultValue={compte.numero ?? ''} className={champ} />
                </label>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1.5"><span className={etiquette}>Solde d&apos;ouverture</span>
                    <input name="soldeOuverture" inputMode="decimal" defaultValue={String(compte.solde_ouverture)} className={champ} />
                </label>
                <label className="block space-y-1.5"><span className={etiquette}>À la date du</span>
                    <input name="dateOuverture" type="date" max={aujourdhui()} defaultValue={compte.date_ouverture} className={champ} />
                </label>
            </div>
            <label className="block space-y-1.5"><span className={etiquette}>Note</span>
                <input name="note" defaultValue={compte.note ?? ''} className={champ} />
            </label>
            <label className="block space-y-1.5"><span className={etiquette}>Motif (obligatoire si le solde ou la date d&apos;ouverture change)</span>
                <input name="motif" className={champ} placeholder="Ex. solde de départ mal saisi" />
            </label>
        </form>
        </Cadre>
    )
}

// ── Virement ───────────────────────────────────────────────────
export function FormulaireVirement({ comptes, sourceParDefaut, modale }: { modale?: EnModale; comptes: CompteChoix[]; sourceParDefaut?: string }) {
    const idForm = useId()
    const [etat, action, enAttente] = useFormulaire(effectuerVirement)
    const [source, setSource] = useState(sourceParDefaut ?? comptes[0]?.id ?? '')
    const destinations = comptes.filter(c => c.id !== source)
    return (
        <Cadre modale={modale} titre="Virement entre comptes" description="Dépôt d’espèces en banque, retrait, recharge Mobile Money." idForm={idForm} enAttente={enAttente} libelle={'Valider le virement'} etat={etat}>
        <form id={idForm} action={action} className="space-y-4">
            <Message etat={etat} />
            <label className="block space-y-1.5"><span className={etiquette}>Depuis le compte</span>
                <select name="compteSourceId" value={source} onChange={e => setSource(e.target.value)} className={champ}>
                    {comptes.map(c => <option key={c.id} value={c.id}>{libelleCompte(c)}</option>)}
                </select>
            </label>
            <label className="block space-y-1.5"><span className={etiquette}>Vers le compte</span>
                <select name="compteDestinationId" className={champ}>
                    {destinations.map(c => <option key={c.id} value={c.id}>{libelleCompte(c)}</option>)}
                </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5"><span className={etiquette}>Montant *</span>
                    <input name="montant" required inputMode="decimal" className={champ} />
                </label>
                <label className="block space-y-1.5"><span className={etiquette}>Frais</span>
                    <input name="frais" inputMode="decimal" placeholder="0" className={champ} />
                </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5"><span className={etiquette}>Date</span>
                    <input name="date" type="date" max={aujourdhui()} defaultValue={aujourdhui()} className={champ} />
                </label>
                <label className="block space-y-1.5"><span className={etiquette}>Référence</span>
                    <input name="reference" placeholder="Bordereau, n° de transaction" className={champ} />
                </label>
            </div>
            <p className="text-xs text-muted-foreground">Les frais sont une dépense sur le compte de départ. Un virement ne change pas le chiffre d&apos;affaires.</p>
        </form>
        </Cadre>
    )
}

// ── Retrait / apport du propriétaire ───────────────────────────
export function FormulaireOperationProprietaire({ comptes, compteParDefaut, modale }: { modale?: EnModale; comptes: CompteChoix[]; compteParDefaut?: string }) {
    const idForm = useId()
    const [etat, action, enAttente] = useFormulaire(enregistrerOperationProprietaire)
    const [type, setType] = useState<'retrait' | 'apport'>('retrait')
    return (
        <Cadre modale={modale} titre="Retrait ou apport du propriétaire" description="Ni chiffre d’affaires ni charge : seul le solde du compte change." idForm={idForm} enAttente={enAttente} libelle={type === 'retrait' ? 'Enregistrer le retrait' : 'Enregistrer l\'apport'} etat={etat}>
        <form id={idForm} action={action} className="space-y-4">
            <Message etat={etat} />
            <div role="group" className="flex gap-2">
                {(['retrait', 'apport'] as const).map(t => (
                    <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}
                            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${type === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'}`}>
                        {t === 'retrait' ? 'Retrait' : 'Apport'}
                    </button>
                ))}
            </div>
            <input type="hidden" name="type" value={type} />
            <label className="block space-y-1.5"><span className={etiquette}>{type === 'retrait' ? 'Sortir de' : 'Remettre sur'}</span>
                <select name="compteId" defaultValue={compteParDefaut ?? comptes[0]?.id} className={champ}>
                    {comptes.map(c => <option key={c.id} value={c.id}>{libelleCompte(c)}</option>)}
                </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5"><span className={etiquette}>Montant *</span>
                    <input name="montant" required inputMode="decimal" className={champ} />
                </label>
                <label className="block space-y-1.5"><span className={etiquette}>Date</span>
                    <input name="date" type="date" max={aujourdhui()} defaultValue={aujourdhui()} className={champ} />
                </label>
            </div>
            <label className="block space-y-1.5"><span className={etiquette}>{type === 'retrait' ? 'Remis à' : 'Apporté par'}</span>
                <input name="beneficiaire" placeholder="Nom de la personne" className={champ} />
            </label>
            <label className="block space-y-1.5"><span className={etiquette}>Motif *</span>
                <input name="motif" required minLength={2} placeholder={type === 'retrait' ? 'Ex. prélèvement personnel' : 'Ex. renflouer la caisse'} className={champ} />
            </label>
            <p className="text-xs text-muted-foreground">Ni chiffre d&apos;affaires ni charge : seul le solde du compte change.</p>
        </form>
        </Cadre>
    )
}

// ── Rapprochement ──────────────────────────────────────────────
export function FormulaireRapprochement({ compteId, nature, modale }: { modale?: EnModale; compteId: string; nature: string }) {
    const idForm = useId()
    const [etat, action, enAttente] = useFormulaire(enregistrerRapprochement)
    return (
        <Cadre modale={modale} titre="Rapprochement" description="Comparez le solde réel au solde du logiciel ; l’écart est constaté, jamais corrigé." idForm={idForm} enAttente={enAttente} libelle={'Enregistrer le rapprochement'} etat={etat}>
        <form id={idForm} action={action} className="space-y-4">
            <Message etat={etat} />
            <input type="hidden" name="compteId" value={compteId} />
            <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                    <span className={etiquette}>{nature === 'caisse' ? 'Espèces comptées' : 'Solde réel (relevé)'} *</span>
                    <input name="soldeReel" required inputMode="decimal" className={champ} />
                </label>
                <label className="block space-y-1.5"><span className={etiquette}>Au</span>
                    <input name="date" type="date" max={aujourdhui()} defaultValue={aujourdhui()} className={champ} />
                </label>
            </div>
            <label className="block space-y-1.5"><span className={etiquette}>Note</span>
                <input name="note" className={champ} placeholder="Ex. relevé du 31/10" />
            </label>
            <p className="text-xs text-muted-foreground">L&apos;écart est constaté et tracé ; rien n&apos;est corrigé automatiquement.</p>
        </form>
        </Cadre>
    )
}

// ── Annuler (virement, retrait, apport) ────────────────────────
export function BoutonAnnulerMouvement({ id, origine, compteId }: { id: string; origine: 'virement' | 'retrait' | 'apport'; compteId: string }) {
    const router = useRouter()
    const [ouvert, setOuvert] = useState(false)
    const [motif, setMotif] = useState('')
    const [erreur, setErreur] = useState<string | null>(null)
    const [enCours, demarrer] = useTransition()

    if (!ouvert) return (
        <button type="button" onClick={() => setOuvert(true)} className="text-xs font-medium text-destructive hover:underline">Annuler</button>
    )
    return (
        <div className="flex flex-col gap-1.5 min-w-[220px]">
            <input value={motif} onChange={e => setMotif(e.target.value)} aria-label="Motif de l'annulation"
                   placeholder="Motif de l'annulation" className="px-2 py-1.5 border border-input rounded text-xs bg-background" />
            {erreur && <span className="text-xs text-destructive">{erreur}</span>}
            <div className="flex gap-2">
                <button type="button" disabled={enCours || motif.trim().length < 3}
                        onClick={() => demarrer(async () => {
                            const r = origine === 'virement'
                                ? await annulerVirement(id, motif, compteId)
                                : await annulerOperationProprietaire(id, motif, compteId)
                            if ('erreur' in r) setErreur(r.erreur); else { setOuvert(false); router.refresh() }
                        })}
                        className="px-2 py-1 rounded bg-destructive text-white text-xs font-medium disabled:opacity-50">
                    {enCours ? '…' : 'Confirmer'}
                </button>
                <button type="button" onClick={() => setOuvert(false)} className="px-2 py-1 rounded border border-input text-xs">Garder</button>
            </div>
        </div>
    )
}

// ── Désactiver / réactiver ─────────────────────────────────────
export function BoutonEtatCompte({ id, actif }: { id: string; actif: boolean }) {
    const router = useRouter()
    const [motif, setMotif] = useState('')
    const [erreur, setErreur] = useState<string | null>(null)
    const [enCours, demarrer] = useTransition()
    return (
        <div className="space-y-2">
            {actif && (
                <input value={motif} onChange={e => setMotif(e.target.value)} aria-label="Motif de la désactivation"
                       placeholder="Motif de la désactivation" className={champ} />
            )}
            {erreur && <p className="text-xs text-destructive">{erreur}</p>}
            <Button type="button" variant="outline" disabled={enCours || (actif && motif.trim().length < 3)}
                    onClick={() => demarrer(async () => {
                        const r = await changerEtatCompte(id, !actif, motif)
                        if ('erreur' in r) setErreur(r.erreur); else router.refresh()
                    })}>
                {actif ? 'Désactiver le compte' : 'Réactiver le compte'}
            </Button>
        </div>
    )
}
