// app/(shop)/compta/tresorerie/[id]/page.tsx
// Fiche d'un compte : solde, journal de TOUTES ses transactions (ventes,
// règlements, dépenses, salaires, fournisseurs, virements, retraits,
// apports), annulations et corrections comprises, rapprochements.

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission, peutVoirSoldes } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { historiqueCorrections } from '@/lib/audit/journaliser'
import {
    LIBELLES_TYPE, ORIGINES_MOUVEMENT, OPERATEURS_MM, formatF, type CompteChoix, type TypeCompte,
} from '@/lib/tresorerie/comptes'
import { BoutonAnnulerMouvement, BoutonEtatCompte } from '@/components/shop/tresorerie/FormulairesTresorerie'
import { ActionsCompteTresorerie } from '@/components/shop/tresorerie/ActionsTresorerie'
import { BoutonCaissieres } from '@/components/shop/tresorerie/CaissesPOS'
import EnTetePage from '@/components/shop/EnTetePage'

export const metadata: Metadata = { title: 'Compte de trésorerie' }

type Mouvement = {
    jour: string; sens: 'entree' | 'sortie'; montant: number; origine: string; origine_id: string
    public_id: string; libelle: string; reference: string | null; est_annule: boolean
    modifie_le: string | null; created_at: string
}
type Rappro = { id: string; date_rapprochement: string; solde_reel: number; solde_theorique: number; ecart: number; note: string | null; created_at: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const fr = (d: string) => new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-FR')

function lienOrigine(m: Mouvement): string | null {
    switch (m.origine) {
        case 'vente':             return `/admin/ventes/${m.origine_id}`
        case 'reglement_facture': return `/admin/factures/${m.origine_id}`
        case 'depense':           return `/compta/depenses/${m.origine_id}`
        default:                  return null
    }
}

export default async function PageCompteTresorerie({
    params, searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ du?: string; au?: string }>
}) {
    const { id } = await params
    const sp = await searchParams

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!peutVoirSoldes(user)) redirect('/admin/dashboard')
    const peutGerer = aPermission(user, PERMISSIONS.TRESORERIE_GERER)

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: compte } = await adminClient.from('comptes_tresorerie')
        .select('*, warehouse:warehouses(nom), reversement:comptes_tresorerie!compte_reversement_id(nom)')
        .eq('id', id).eq('shop_id', shopId).maybeSingle()
    if (!compte) notFound()

    // Période : par défaut le mois en cours.
    const auj = new Date().toISOString().split('T')[0]
    const du  = sp.du && DATE.test(sp.du) ? sp.du : auj.slice(0, 8) + '01'
    const au  = sp.au && DATE.test(sp.au) ? sp.au : auj
    const veille = new Date(new Date(du + 'T12:00:00Z').getTime() - 86400000).toISOString().split('T')[0]

    const [{ data: soldesDebut }, { data: soldesTout }, { data: mouvements }, { data: rappros }, corrections, { data: autres }] = await Promise.all([
        adminClient.rpc('soldes_comptes', { p_shop_id: shopId, p_au: veille }),
        adminClient.rpc('soldes_comptes', { p_shop_id: shopId }),
        adminClient.from('mouvements_tresorerie')
            .select('jour, sens, montant, origine, origine_id, public_id, libelle, reference, est_annule, modifie_le, created_at')
            .eq('compte_id', id).gte('jour', du).lte('jour', au)
            .order('jour').order('created_at'),
        adminClient.from('rapprochements_tresorerie')
            .select('id, date_rapprochement, solde_reel, solde_theorique, ecart, note, created_at')
            .eq('compte_id', id).order('date_rapprochement', { ascending: false }),
        historiqueCorrections(shopId, id),
        adminClient.from('comptes_tresorerie')
            .select('id, public_id, type, nom, operateur, numero, warehouse_id')
            .eq('shop_id', shopId).eq('est_actif', true).order('nom'),
    ])

    const ligneDe = (rows: unknown) => ((rows ?? []) as { compte_id: string; solde: number }[]).find(r => r.compte_id === id)
    const soldeDebut  = Number(ligneDe(soldesDebut)?.solde ?? 0)
    const soldeActuel = Number(ligneDe(soldesTout)?.solde ?? 0)
    const soldesMap   = new Map(((soldesTout ?? []) as { compte_id: string; solde: number }[]).map(r => [r.compte_id, Number(r.solde)]))

    // Journal : mouvements + rapprochements de la période, solde progressif.
    type Ligne = { cle: string; jour: string; quand: string; m?: Mouvement; r?: Rappro; solde?: number }
    const lignes: Ligne[] = [
        ...((mouvements ?? []) as Mouvement[]).map(m => ({ cle: `${m.origine}-${m.public_id}-${m.sens}`, jour: m.jour, quand: m.created_at, m })),
        ...((rappros ?? []) as Rappro[])
            .filter(r => r.date_rapprochement >= du && r.date_rapprochement <= au)
            .map(r => ({ cle: `rap-${r.id}`, jour: r.date_rapprochement, quand: r.created_at, r })),
    ].sort((a, b) => a.jour.localeCompare(b.jour) || a.quand.localeCompare(b.quand)
        // Même instant (frais d'un virement) : l'opération avant ses frais.
        || Number((a as Ligne).m?.origine === 'depense') - Number((b as Ligne).m?.origine === 'depense'))

    let courant = soldeDebut, totalEntrees = 0, totalSorties = 0
    for (const l of lignes) {
        if (l.m && !l.m.est_annule) {
            const v = Number(l.m.montant)
            if (l.m.sens === 'entree') { courant += v; totalEntrees += v } else { courant -= v; totalSorties += v }
        }
        if (l.m) l.solde = courant
    }

    // Une jointure PostgREST peut revenir en objet ou en tableau.
    const un = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { nom?: string } | null | undefined
    // (mig 044) caisse POS : ses caissières, et tous les utilisateurs à proposer.
    const estCaissePOS = compte.type === 'caisse' && !!compte.warehouse_id && compte.est_actif
    const ROLES_FR: Record<string, string> = {
        super_admin_boutique: 'Propriétaire', admin_boutique: 'Administrateur', vendeur: 'Vendeur',
        stock_manager: 'Gestionnaire stock', comptable: 'Comptable',
    }
    const [{ data: equipe }, { data: affectations }] = estCaissePOS
        ? await Promise.all([
            adminClient.from('shop_users').select('id, nom_complet, role').eq('shop_id', shopId).eq('est_actif', true).order('nom_complet'),
            adminClient.from('caisse_utilisateurs').select('user_id, compte_id, caisse:comptes_tresorerie(nom)').eq('shop_id', shopId),
        ])
        : [{ data: [] }, { data: [] }]
    const caisseDe = new Map((affectations ?? []).map(a => [a.user_id, a]))
    const utilisateursCaisse = (equipe ?? []).map(u => {
        const a = caisseDe.get(u.id)
        return { id: u.id, nom: u.nom_complet, role: ROLES_FR[u.role] ?? u.role,
                 caisseActuelle: a ? (un(a.caisse)?.nom ?? null) : null, ici: a?.compte_id === id }
    })
    const caissieresIci = utilisateursCaisse.filter(u => u.ici)

    const choix: CompteChoix[] = (autres ?? []).map(c => ({ ...c, type: c.type as TypeCompte, solde: soldesMap.get(c.id) ?? 0 }))
    const operateur = OPERATEURS_MM.find(o => o.code === compte.operateur)?.label
    const w = un(compte.warehouse)?.nom ? un(compte.warehouse) : null
    const rev = un(compte.reversement)?.nom ? un(compte.reversement) : null

    return (
        <div className="flex flex-col min-h-screen">
            <EnTetePage
                titre={compte.nom}
                sousTitre={[
                    `${LIBELLES_TYPE[compte.type as TypeCompte]} · ${compte.public_id}`,
                    operateur, compte.banque, compte.numero,
                    compte.est_principale ? 'caisse principale (le coffre)' : null,
                    w ? `caisse POS · entrepôt ${w.nom}` : null, rev ? `reversé sur ${rev.nom}` : null,
                    compte.est_actif ? null : 'désactivé',
                ].filter(Boolean).join(' · ')}
                ariane={[{ label: 'Finances' }, { label: 'Trésorerie', href: '/compta/tresorerie' }, { label: compte.nom }]}
                actions={peutGerer ? (
                    <>
                    {estCaissePOS && <BoutonCaissieres compteId={id} nomCaisse={compte.nom} utilisateurs={utilisateursCaisse} />}
                    <ActionsCompteTresorerie comptes={choix} compte={{
                        id, type: compte.type, nom: compte.nom, operateur: compte.operateur, banque: compte.banque,
                        numero: compte.numero, solde_ouverture: Number(compte.solde_ouverture),
                        date_ouverture: compte.date_ouverture, note: compte.note, est_actif: compte.est_actif, est_principale: compte.est_principale,
                    }} />
                    </>
                ) : undefined}
            />

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 space-y-5">
                <section aria-label="Soldes" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="col-span-2 lg:col-span-1 rounded-xl p-4 bg-[var(--nav)] text-white">
                        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Solde actuel</p>
                        <p className="text-2xl font-bold tabular-nums mt-1">{formatF(soldeActuel)}</p>
                        <p className="text-xs text-white/70 mt-1">Ouverture : {formatF(Number(compte.solde_ouverture))} au {fr(compte.date_ouverture)}</p>
                    </div>
                    <div className="rounded-xl p-4 bg-card border border-border">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Solde au {fr(du)}</p>
                        <p className="text-lg font-bold tabular-nums mt-1">{formatF(soldeDebut)}</p>
                    </div>
                    <div className="rounded-xl p-4 bg-card border border-border">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entrées de la période</p>
                        <p className="text-lg font-bold tabular-nums mt-1 text-[var(--primary-strong)]">+ {formatF(totalEntrees)}</p>
                    </div>
                    <div className="rounded-xl p-4 bg-card border border-border">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sorties de la période</p>
                        <p className="text-lg font-bold tabular-nums mt-1 text-[var(--rouge-texte)]">− {formatF(totalSorties)}</p>
                    </div>
                </section>

                <div className="flex flex-col xl:flex-row gap-6 items-start">
                    <section aria-labelledby="journal" className="flex-1 min-w-0 w-full bg-card border border-border rounded-xl">
                        <div className="flex flex-wrap items-end justify-between gap-3 p-4 border-b border-border">
                            <h2 id="journal" className="font-semibold">Journal du compte</h2>
                            <form className="flex flex-wrap items-end gap-2" action="">
                                <label className="text-xs text-muted-foreground flex flex-col gap-1">Du
                                    <input type="date" name="du" defaultValue={du} max={auj} className="px-2 py-1.5 border border-input rounded bg-background text-sm text-foreground" />
                                </label>
                                <label className="text-xs text-muted-foreground flex flex-col gap-1">Au
                                    <input type="date" name="au" defaultValue={au} max={auj} className="px-2 py-1.5 border border-input rounded bg-background text-sm text-foreground" />
                                </label>
                                <button type="submit" className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium">Afficher</button>
                            </form>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                                        <th className="px-4 py-2">Date</th><th className="px-4 py-2">Opération</th>
                                        <th className="px-4 py-2 text-right">Entrée</th><th className="px-4 py-2 text-right">Sortie</th>
                                        <th className="px-4 py-2 text-right">Solde</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t border-border bg-muted/40">
                                        <td className="px-4 py-2 text-muted-foreground">{fr(du)}</td>
                                        <td className="px-4 py-2 font-medium" colSpan={3}>Solde de début de période</td>
                                        <td className="px-4 py-2 text-right font-bold tabular-nums">{formatF(soldeDebut)}</td>
                                    </tr>
                                    {lignes.length === 0 && (
                                        <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucune transaction sur cette période.</td></tr>
                                    )}
                                    {lignes.map(l => l.r ? (
                                        <tr key={l.cle} className="border-t border-border bg-amber-50/60">
                                            <td className="px-4 py-2 text-muted-foreground">{fr(l.jour)}</td>
                                            <td className="px-4 py-2" colSpan={3}>
                                                <span className="font-medium">Rapprochement</span> — réel {formatF(Number(l.r.solde_reel))}, logiciel {formatF(Number(l.r.solde_theorique))}
                                                {' · '}<span className={Number(l.r.ecart) === 0 ? 'text-blue-700' : 'text-red-700 font-semibold'}>
                                                    {Number(l.r.ecart) === 0 ? 'aucun écart' : `écart ${formatF(Number(l.r.ecart))}`}
                                                </span>
                                                {l.r.note && <span className="text-muted-foreground"> · {l.r.note}</span>}
                                            </td>
                                            <td />
                                        </tr>
                                    ) : l.m && (
                                        <tr key={l.cle} className={`border-t border-border ${l.m.est_annule ? 'text-muted-foreground' : ''}`}>
                                            <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{fr(l.jour)}</td>
                                            <td className="px-4 py-2">
                                                <div className={l.m.est_annule ? 'line-through' : ''}>
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-2">{ORIGINES_MOUVEMENT[l.m.origine] ?? l.m.origine}</span>
                                                    {lienOrigine(l.m)
                                                        ? <Link href={lienOrigine(l.m)!} className="font-medium hover:underline">{l.m.libelle}</Link>
                                                        : <span className="font-medium">{l.m.libelle}</span>}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                                                    <span>{l.m.public_id}</span>
                                                    {l.m.reference && <span>réf. {l.m.reference}</span>}
                                                    {l.m.est_annule && <span className="text-red-700 font-medium">annulé — hors solde</span>}
                                                    {l.m.modifie_le && <span className="text-amber-700 font-medium">corrigé le {new Date(l.m.modifie_le).toLocaleDateString('fr-FR')}</span>}
                                                </div>
                                                {peutGerer && !l.m.est_annule && (l.m.origine === 'virement' || l.m.origine === 'retrait' || l.m.origine === 'apport') && (
                                                    <div className="mt-1"><BoutonAnnulerMouvement id={l.m.origine_id} origine={l.m.origine} compteId={id} /></div>
                                                )}
                                            </td>
                                            <td className={`px-4 py-2 text-right tabular-nums whitespace-nowrap ${l.m.est_annule ? 'line-through' : 'text-blue-700'}`}>
                                                {l.m.sens === 'entree' ? formatF(Number(l.m.montant)) : ''}
                                            </td>
                                            <td className={`px-4 py-2 text-right tabular-nums whitespace-nowrap ${l.m.est_annule ? 'line-through' : 'text-red-700'}`}>
                                                {l.m.sens === 'sortie' ? formatF(Number(l.m.montant)) : ''}
                                            </td>
                                            <td className="px-4 py-2 text-right font-semibold tabular-nums whitespace-nowrap">{formatF(l.solde ?? 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <aside className="w-full xl:w-[380px] space-y-3">
                        {peutGerer && compte.est_actif && !compte.est_principale && (
                            <section className="bg-card border border-border rounded-xl p-4 space-y-2" aria-labelledby="zone">
                                <h2 id="zone" className="font-semibold text-sm">Désactiver ce compte</h2>
                                <p className="text-xs text-muted-foreground">Possible seulement quand son solde est nul ; son journal reste consultable.</p>
                                <BoutonEtatCompte id={id} actif={compte.est_actif} />
                            </section>
                        )}

                        {estCaissePOS && (
                            <section className="bg-card border border-border rounded-xl p-4 space-y-2" aria-labelledby="caissieres">
                                <h2 id="caissieres" className="font-semibold text-sm">Caissières ({caissieresIci.length})</h2>
                                {caissieresIci.length === 0
                                    ? <p className="text-sm text-muted-foreground">Personne n&apos;est affecté à cette caisse ; seuls les administrateurs peuvent y vendre.</p>
                                    : <ul className="text-sm space-y-1">{caissieresIci.map(u => <li key={u.id}>{u.nom} <span className="text-xs text-muted-foreground">· {u.role}</span></li>)}</ul>}
                            </section>
                        )}

                        <section className="bg-card border border-border rounded-xl p-4 space-y-3" aria-labelledby="hist">
                            <h2 id="hist" className="font-semibold text-sm">Historique du compte</h2>
                            {corrections.length === 0 && <p className="text-sm text-muted-foreground">Aucune modification.</p>}
                            <ul className="space-y-2">
                                {corrections.map((c, i) => {
                                    const d = (c.details_json ?? {}) as { modifications?: { libelle: string; avant: unknown; apres: unknown }[]; motif?: string | null }
                                    return (
                                        <li key={i} className="text-xs border-l-2 border-border pl-3">
                                            <p className="font-medium text-foreground">
                                                {({ TRESORERIE_COMPTE_CREE: 'Création', TRESORERIE_COMPTE_MODIFIE: 'Modification',
                                                    TRESORERIE_COMPTE_DESACTIVE: 'Désactivation', TRESORERIE_COMPTE_REACTIVE: 'Réactivation' } as Record<string, string>)[c.event_type] ?? c.event_type}
                                                {' · '}{new Date(c.created_at).toLocaleString('fr-FR')}{c.user_nom ? ` · ${c.user_nom}` : ''}
                                            </p>
                                            {(d.modifications ?? []).map((m, j) => (
                                                <p key={j} className="text-muted-foreground">{m.libelle} : {String(m.avant ?? '—')} → {String(m.apres ?? '—')}</p>
                                            ))}
                                            {d.motif && <p className="text-muted-foreground">Motif : {d.motif}</p>}
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>

                        {(rappros ?? []).length > 0 && (
                            <section className="bg-card border border-border rounded-xl p-4 space-y-2" aria-labelledby="rap">
                                <h2 id="rap" className="font-semibold text-sm">Rapprochements</h2>
                                <ul className="text-xs space-y-1">
                                    {(rappros as Rappro[]).slice(0, 12).map(r => (
                                        <li key={r.id} className="flex justify-between gap-2">
                                            <span>{fr(r.date_rapprochement)}</span>
                                            <span className={Number(r.ecart) === 0 ? 'text-blue-700' : 'text-red-700 font-semibold'}>
                                                {Number(r.ecart) === 0 ? 'juste' : `écart ${formatF(Number(r.ecart))}`}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </aside>
                </div>
            </main>
        </div>
    )
}
