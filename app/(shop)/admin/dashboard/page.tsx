// app/(shop)/admin/dashboard/page.tsx
// Tableau de bord — nouveau design (lot 2). Chaque bloc n'apparaît que si
// l'utilisateur a la permission qui va avec (la même que la page cible).

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, Plus, Package, FileText, Truck, Banknote, Smartphone, Landmark, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission, peutVoirSoldes } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { CHEMIN_ABONNEMENT } from '@/lib/abonnement/regle'
import { jourBoutique, DECALAGE_BOUTIQUE_HEURES, MOIS_FR } from '@/lib/dates/periode'
import { formatF, ORIGINES_MOUVEMENT } from '@/lib/tresorerie/comptes'
import EnTetePage from '@/components/shop/EnTetePage'

export const metadata: Metadata = { title: 'Tableau de bord' }

const PERIODES = { jour: 'Aujourd\'hui', '7j': '7 jours', mois: 'Mois' } as const
type Periode = keyof typeof PERIODES

const decaler = (jour: string, n: number) =>
    new Date(new Date(jour + 'T12:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10)
const jourDe = (instant: string) =>
    new Date(new Date(instant).getTime() + DECALAGE_BOUTIQUE_HEURES * 3600000).toISOString().slice(0, 10)
const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const ICONES_TYPE: Record<string, React.ElementType> = { caisse: Banknote, mobile_money: Smartphone, banque: Landmark, tpe: CreditCard }

export default async function PageTableauDeBord({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const meta   = user.user_metadata
    const shopId = meta.shop_id as string
    const db     = createAdminClient()
    const sp     = await searchParams
    const periode: Periode = sp.periode && sp.periode in PERIODES ? sp.periode as Periode : 'jour'

    const voit = {
        ventes:       aPermission(user, PERMISSIONS.VENTES_VOIR),
        creances:     aPermission(user, PERMISSIONS.CLIENTS_ACCES_COMPLET),
        factures:     aPermission(user, PERMISSIONS.FACTURES_VOIR),
        fournisseurs: aPermission(user, PERMISSIONS.FOURNISSEURS_VOIR),
        stock:        aPermission(user, PERMISSIONS.STOCK_VOIR),
        soldes:       peutVoirSoldes(user),
        caisse:       aPermission(user, PERMISSIONS.VENTES_CREER),
    }

    const auj   = jourBoutique()
    const debut = periode === 'jour' ? auj : periode === '7j' ? decaler(auj, -6) : auj.slice(0, 8) + '01'
    const debut7 = decaler(auj, -6)

    const vide = Promise.resolve({ data: null })
    const [
        { data: boutique }, { data: ca }, { data: ventes7 }, { data: facturesOuvertes }, { data: ardoises },
        { data: fournisseurs }, { data: ffAPayer }, { data: produits }, { data: soldes }, { data: comptes },
        { data: operations }, { data: sessions },
    ] = await Promise.all([
        db.from('shops').select('nom, plan, plan_expire_le').eq('id', shopId).single(),
        voit.ventes ? db.rpc('ca_periode', { p_shop_id: shopId, p_debut: debut, p_fin: auj, p_decalage: `${DECALAGE_BOUTIQUE_HEURES} hours` }) : vide,
        voit.ventes ? db.from('sales').select('montant_total, created_at').eq('shop_id', shopId).eq('statut', 'completee')
            .gte('created_at', `${debut7}T00:00:00Z`) : vide,
        voit.creances ? db.from('factures').select('montant_restant, date_echeance').eq('shop_id', shopId)
            .in('statut', ['emise', 'partiellement_payee']) : vide,
        voit.creances ? db.from('clients').select('credit_balance').eq('shop_id', shopId).gt('credit_balance', 0) : vide,
        voit.fournisseurs ? db.from('suppliers').select('solde_du:solde_dû').eq('shop_id', shopId) : vide,
        voit.fournisseurs ? db.from('factures_fournisseurs').select('montant_restant, date_echeance').eq('shop_id', shopId)
            .in('statut', ['non_payee', 'partiellement_payee']).lte('date_echeance', decaler(auj, 7)) : vide,
        voit.stock ? db.from('products').select('seuil_alerte, stock_levels(quantite)').eq('shop_id', shopId).eq('est_actif', true) : vide,
        voit.soldes ? db.rpc('soldes_comptes', { p_shop_id: shopId }) : vide,
        voit.soldes ? db.from('comptes_tresorerie').select('id, nom, type, numero').eq('shop_id', shopId).eq('est_actif', true) : vide,
        voit.soldes ? db.from('mouvements_tresorerie').select('compte_id, sens, montant, origine, libelle, public_id, created_at')
            .eq('shop_id', shopId).eq('est_annule', false).order('created_at', { ascending: false }).limit(6) : vide,
        voit.caisse ? db.from('cash_sessions').select('statut, ouverte_le, warehouses(nom)').eq('shop_id', shopId).eq('jour', auj) : vide,
    ])

    // ── Chiffres ───────────────────────────────────────────────
    const c = ((Array.isArray(ca) ? ca[0] : ca) ?? {}) as Record<string, number>
    const nbVentes = Number(c.nb_ventes ?? 0), caPeriode = Number(c.ca_facture ?? 0)
    const encaisse = Number(c.encaisse_total ?? 0), credit = Number(c.credit_accorde ?? 0)

    const fo = (facturesOuvertes ?? []) as { montant_restant: number; date_echeance: string | null }[]
    const creances = fo.reduce((a, f) => a + Number(f.montant_restant), 0)
        + ((ardoises ?? []) as { credit_balance: number }[]).reduce((a, x) => a + Number(x.credit_balance), 0)
    const enRetard = fo.filter(f => f.date_echeance && f.date_echeance < auj)
    const montantRetard = enRetard.reduce((a, f) => a + Number(f.montant_restant), 0)

    const dettes = ((fournisseurs ?? []) as unknown as { solde_du: number }[]).reduce((a, f) => a + Number(f.solde_du ?? 0), 0)
    const ffSemaine = ((ffAPayer ?? []) as { montant_restant: number }[])

    const sousSeuil = ((produits ?? []) as { seuil_alerte: number; stock_levels: { quantite: number }[] }[])
        .map(p => ({ seuil: p.seuil_alerte, stock: p.stock_levels.reduce((a, s) => a + Number(s.quantite), 0) }))
        .filter(p => p.stock <= p.seuil)
    const ruptures = sousSeuil.filter(p => p.stock <= 0).length

    const parJour = new Map<string, number>()
    for (let i = 0; i < 7; i++) parJour.set(decaler(debut7, i), 0)
    for (const v of (ventes7 ?? []) as { montant_total: number; created_at: string }[]) {
        const j = jourDe(v.created_at)
        if (parJour.has(j)) parJour.set(j, (parJour.get(j) ?? 0) + Number(v.montant_total))
    }
    const barres = [...parJour.entries()]
    const maxBarre = Math.max(1, ...barres.map(([, v]) => v))

    const soldeDe = new Map(((soldes ?? []) as { compte_id: string; solde: number }[]).map(s => [s.compte_id, Number(s.solde)]))
    const listeComptes = ((comptes ?? []) as { id: string; nom: string; type: string; numero: string | null }[])
        .map(cpt => ({ ...cpt, solde: soldeDe.get(cpt.id) ?? 0 }))
        .sort((a, b) => b.solde - a.solde)
    const totalDispo = listeComptes.reduce((a, x) => a + x.solde, 0)
    const nomCompte = new Map(listeComptes.map(x => [x.id, x.nom]))

    const sessionsJour = (sessions ?? []) as { statut: string; ouverte_le: string; warehouses: { nom: string } | { nom: string }[] | null }[]
    const ouverte = sessionsJour.find(s => s.statut === 'ouverte')
    const nomEntrepot = (w: typeof sessionsJour[number]['warehouses']) => (Array.isArray(w) ? w[0]?.nom : w?.nom) ?? ''

    const expireBientot = boutique?.plan_expire_le
        ? new Date(boutique.plan_expire_le) < new Date(Date.now() + 7 * 86400000) : false

    const dateLongue = new Date(auj + 'T12:00:00Z')
    const sousTitre = [
        `${['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dateLongue.getUTCDay()]} ${dateLongue.getUTCDate()} ${MOIS_FR[dateLongue.getUTCMonth() + 1]?.toLowerCase() ?? ''}`,
        voit.caisse ? (ouverte
            ? `caisse du jour ouverte à ${new Date(ouverte.ouverte_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Porto-Novo' })} (${nomEntrepot(ouverte.warehouses)})`
            : 'caisse du jour pas encore ouverte') : null,
    ].filter(Boolean).join(' · ')

    const carte = 'rounded-2xl p-5 bg-card border border-border flex flex-col gap-1.5'
    const etiquette = 'text-xs font-bold tracking-wide uppercase text-muted-foreground'
    const chiffre = 'titre-design text-2xl sm:text-3xl font-bold tabular-nums'

    return (
        <div className="flex flex-col min-h-screen">
            <EnTetePage
                titre={`Bonjour ${String(meta.nom_complet ?? '').split(' ')[0]}`}
                sousTitre={sousTitre}
                actions={<>
                    {voit.ventes && (
                        <div role="group" aria-label="Période" className="flex gap-1 p-1 rounded-xl bg-card border border-border">
                            {(Object.keys(PERIODES) as Periode[]).map(p => (
                                <Link key={p} href={`/admin/dashboard?periode=${p}`} aria-current={p === periode ? 'true' : undefined}
                                      className={`px-3.5 h-9 flex items-center rounded-lg text-sm font-semibold ${p === periode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                                    {PERIODES[p]}
                                </Link>
                            ))}
                        </div>
                    )}
                    {voit.caisse && (
                        <a href="/pos" target="_blank" rel="noopener noreferrer"
                           className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" aria-hidden="true" />Nouvelle vente
                        </a>
                    )}
                </>}
            />

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 space-y-5">
                {expireBientot && (
                    <div role="status" className="rounded-xl px-4 py-3 text-sm flex items-start gap-2 bg-accent text-accent-foreground">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>Votre abonnement expire le <strong>{new Date(boutique!.plan_expire_le!).toLocaleDateString('fr-FR')}</strong>.{' '}
                            <Link href={CHEMIN_ABONNEMENT} className="font-semibold underline">Le renouveler</Link></span>
                    </div>
                )}

                {/* ── Indicateurs ─────────────────────────────── */}
                <section aria-label="Indicateurs" className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                    {voit.ventes && (
                        <div className="rounded-2xl p-5 flex flex-col gap-1.5 bg-[#FACC15] text-[#1A1400]">
                            <span className="text-xs font-bold tracking-wide uppercase">Chiffre d&apos;affaires · {PERIODES[periode].toLowerCase()}</span>
                            <span className={chiffre}>{formatF(caPeriode)}</span>
                            <span className="text-sm font-semibold">{nbVentes} vente{nbVentes > 1 ? 's' : ''}{nbVentes ? ` · panier moyen ${formatF(caPeriode / nbVentes)}` : ''}</span>
                        </div>
                    )}
                    {voit.ventes && (
                        <div className={carte}>
                            <span className={etiquette}>Encaissé</span>
                            <span className={chiffre}>{formatF(encaisse)}</span>
                            <span className="text-sm text-muted-foreground">{credit > 0 ? `${formatF(credit)} accordés à crédit` : 'Aucun crédit accordé'}</span>
                        </div>
                    )}
                    {voit.creances && (
                        <div className={carte}>
                            <span className={etiquette}>Clients me doivent</span>
                            <span className={chiffre}>{formatF(creances)}</span>
                            <span className={`text-sm ${montantRetard > 0 ? 'font-semibold text-[var(--rouge-texte)]' : 'text-muted-foreground'}`}>
                                {montantRetard > 0 ? `dont ${formatF(montantRetard)} en retard` : 'Rien en retard'}
                            </span>
                        </div>
                    )}
                    {voit.fournisseurs && (
                        <div className={carte}>
                            <span className={etiquette}>Je dois aux fournisseurs</span>
                            <span className={chiffre}>{formatF(dettes)}</span>
                            <span className="text-sm text-muted-foreground">
                                {ffSemaine.length > 0 ? `${ffSemaine.length} facture${ffSemaine.length > 1 ? 's' : ''} à régler sous 7 jours` : 'Aucune échéance sous 7 jours'}
                            </span>
                        </div>
                    )}
                </section>

                <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                    {/* ── Soldes des comptes ───────────────────── */}
                    {voit.soldes && (
                        <section aria-labelledby="t-soldes" className="rounded-2xl bg-card border border-border p-5 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h2 id="t-soldes" className="text-lg font-bold">Soldes des comptes</h2>
                                <Link href="/compta/tresorerie" className="text-sm font-semibold text-primary hover:underline">Trésorerie →</Link>
                            </div>
                            <ul className="divide-y divide-border">
                                {listeComptes.slice(0, 5).map(x => {
                                    const Icone = ICONES_TYPE[x.type] ?? Banknote
                                    return (
                                        <li key={x.id}>
                                            <Link href={`/compta/tresorerie/${x.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                                                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${x.type === 'caisse' ? 'bg-accent text-accent-foreground' : 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'}`}>
                                                    <Icone className="w-5 h-5" aria-hidden="true" />
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block font-semibold text-sm truncate">{x.nom}</span>
                                                    {x.numero && <span className="block text-xs text-muted-foreground">{x.numero}</span>}
                                                </span>
                                                <span className={`font-bold text-sm tabular-nums ${x.solde < 0 ? 'text-[var(--rouge-texte)]' : ''}`}>{formatF(x.solde)}</span>
                                            </Link>
                                        </li>
                                    )
                                })}
                                {listeComptes.length === 0 && <li className="py-6 text-sm text-muted-foreground text-center">Aucun compte de trésorerie.</li>}
                            </ul>
                            <div className="flex justify-between items-center rounded-xl px-4 py-3 bg-[var(--surface2)] border border-border">
                                <span className="font-semibold text-sm">Total disponible · {listeComptes.length} compte{listeComptes.length > 1 ? 's' : ''}</span>
                                <span className="titre-design text-lg font-bold tabular-nums">{formatF(totalDispo)}</span>
                            </div>
                        </section>
                    )}

                    {/* ── Ventes des 7 derniers jours ──────────── */}
                    {voit.ventes && (
                        <section aria-labelledby="t-ventes" className="rounded-2xl bg-card border border-border p-5 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h2 id="t-ventes" className="text-lg font-bold">Ventes des 7 derniers jours</h2>
                                <Link href="/admin/ventes" className="text-sm font-semibold text-primary hover:underline">Ventes →</Link>
                            </div>
                            <div role="img" aria-label={`Ventes par jour : ${barres.map(([j, v]) => `${j} ${formatF(v)}`).join(', ')}`}
                                 className="flex items-end gap-2 sm:gap-3 h-56 pt-2">
                                {barres.map(([j, v], i) => (
                                    <div key={j} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5">
                                        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{v ? Math.round(v / 1000) + ' k' : ''}</span>
                                        <div className={`w-full max-w-11 rounded-t-lg rounded-b ${i === barres.length - 1 ? 'bg-primary' : 'bg-[var(--primary-soft)] dark:bg-[#2A3D73]'}`}
                                             style={{ height: `${Math.max(4, Math.round(v / maxBarre * 160))}px` }} />
                                        <span className="text-xs text-muted-foreground">{i === barres.length - 1 ? 'Auj.' : JOURS_COURTS[new Date(j + 'T12:00:00Z').getUTCDay()]}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                <div className="grid gap-4 grid-cols-1 xl:grid-cols-3">
                    {/* ── À surveiller ─────────────────────────── */}
                    <section aria-labelledby="t-alertes" className="rounded-2xl bg-card border border-border p-5 flex flex-col gap-3">
                        <h2 id="t-alertes" className="text-lg font-bold">À surveiller</h2>
                        {voit.factures && voit.creances && (
                            <Link href="/admin/factures" className={`flex gap-3 items-start p-3 rounded-xl text-sm ${enRetard.length ? 'bg-[var(--rouge-doux)] text-[var(--rouge-texte)]' : 'bg-[var(--surface2)] text-muted-foreground'}`}>
                                <FileText className="w-5 h-5 shrink-0" aria-hidden="true" />
                                <span>{enRetard.length ? <><b>{enRetard.length} facture{enRetard.length > 1 ? 's' : ''} en retard</b> — {formatF(montantRetard)} à relancer</> : 'Aucune facture en retard'}</span>
                            </Link>
                        )}
                        {voit.stock && (
                            <Link href="/stock/produits" className={`flex gap-3 items-start p-3 rounded-xl text-sm ${sousSeuil.length ? 'bg-accent text-accent-foreground' : 'bg-[var(--surface2)] text-muted-foreground'}`}>
                                <Package className="w-5 h-5 shrink-0" aria-hidden="true" />
                                <span>{sousSeuil.length ? <><b>{sousSeuil.length} produit{sousSeuil.length > 1 ? 's' : ''} sous le seuil</b>{ruptures ? ` — dont ${ruptures} en rupture` : ''}</> : 'Aucun produit sous le seuil'}</span>
                            </Link>
                        )}
                        {voit.fournisseurs && (
                            <Link href="/stock/factures-fournisseurs" className={`flex gap-3 items-start p-3 rounded-xl text-sm ${ffSemaine.length ? 'bg-[var(--primary-soft)] text-[var(--primary-strong)]' : 'bg-[var(--surface2)] text-muted-foreground'}`}>
                                <Truck className="w-5 h-5 shrink-0" aria-hidden="true" />
                                <span>{ffSemaine.length ? <><b>{ffSemaine.length} facture{ffSemaine.length > 1 ? 's' : ''} fournisseur</b> à régler sous 7 jours</> : 'Aucune facture fournisseur à échéance'}</span>
                            </Link>
                        )}
                    </section>

                    {/* ── Dernières opérations ─────────────────── */}
                    {voit.soldes && (
                        <section aria-labelledby="t-ops" className="xl:col-span-2 rounded-2xl bg-card border border-border p-5 flex flex-col gap-3 min-w-0">
                            <div className="flex items-center justify-between">
                                <h2 id="t-ops" className="text-lg font-bold">Dernières opérations</h2>
                                <Link href="/compta/tresorerie" className="text-sm font-semibold text-primary hover:underline">Tout voir →</Link>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[540px] text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                                            <th className="py-2 pr-3 font-bold">Heure</th><th className="py-2 pr-3 font-bold">Opération</th>
                                            <th className="py-2 pr-3 font-bold">Compte</th><th className="py-2 text-right font-bold">Montant</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {((operations ?? []) as { compte_id: string; sens: string; montant: number; origine: string; libelle: string; public_id: string; created_at: string }[]).map(o => (
                                            <tr key={`${o.public_id}-${o.sens}-${o.compte_id}`} className="border-t border-border">
                                                <td className="py-2.5 pr-3 text-muted-foreground tabular-nums whitespace-nowrap">
                                                    {new Date(o.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Porto-Novo' })}
                                                </td>
                                                <td className="py-2.5 pr-3"><span className="font-semibold">{o.libelle}</span>
                                                    <span className="block text-xs text-muted-foreground">{ORIGINES_MOUVEMENT[o.origine] ?? o.origine}</span></td>
                                                <td className="py-2.5 pr-3"><span className="px-2.5 py-1 rounded-full bg-[var(--surface2)] border border-border text-xs">{nomCompte.get(o.compte_id) ?? '—'}</span></td>
                                                <td className={`py-2.5 text-right font-bold tabular-nums whitespace-nowrap ${o.sens === 'entree' ? 'text-[var(--primary-strong)]' : 'text-[var(--rouge-texte)]'}`}>
                                                    {o.sens === 'entree' ? '+ ' : '− '}{formatF(Number(o.montant))}
                                                </td>
                                            </tr>
                                        ))}
                                        {(operations ?? []).length === 0 && (
                                            <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Aucune opération pour l&apos;instant.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </div>
            </main>
        </div>
    )
}
