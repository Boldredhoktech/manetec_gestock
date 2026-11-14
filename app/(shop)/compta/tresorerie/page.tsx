// app/(shop)/compta/tresorerie/page.tsx
// Comptes de trésorerie — nouveau design (lot 2). Les formulaires
// (virement, retrait / apport, nouveau compte) s'ouvrent en modale.

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Landmark, Smartphone, Banknote, CreditCard, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission, peutVoirSoldes } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { LIBELLES_TYPE, TYPES_COMPTE, formatF, type CompteChoix, type TypeCompte } from '@/lib/tresorerie/comptes'
import EnTetePage from '@/components/shop/EnTetePage'
import { ActionsListeTresorerie } from '@/components/shop/tresorerie/ActionsTresorerie'

export const metadata: Metadata = { title: 'Trésorerie' }

const ICONES: Record<TypeCompte, React.ElementType> = {
    caisse: Banknote, mobile_money: Smartphone, banque: Landmark, tpe: CreditCard,
}
const PASTILLES: Record<TypeCompte, string> = {
    caisse:       'bg-accent text-accent-foreground',
    mobile_money: 'bg-[var(--primary-soft)] text-[var(--primary-strong)]',
    banque:       'bg-[var(--primary-soft)] text-[var(--primary-strong)]',
    tpe:          'bg-muted text-muted-foreground',
}

export default async function PageTresorerie() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!peutVoirSoldes(user)) redirect('/admin/dashboard')
    const peutGerer = aPermission(user, PERMISSIONS.TRESORERIE_GERER)

    const shopId = user.user_metadata.shop_id as string
    const db = createAdminClient()

    const [{ data: comptes }, { data: soldes }, { data: rappro }, { data: sessions }] = await Promise.all([
        db.from('comptes_tresorerie')
            .select('id, public_id, type, nom, operateur, numero, warehouse_id, est_actif')
            .eq('shop_id', shopId).order('nom'),
        db.rpc('soldes_comptes', { p_shop_id: shopId }),
        db.from('rapprochements_tresorerie').select('compte_id, date_rapprochement, ecart')
            .eq('shop_id', shopId).order('date_rapprochement', { ascending: false }),
        db.from('cash_sessions').select('warehouse_id, statut').eq('shop_id', shopId).eq('statut', 'ouverte'),
    ])

    const soldeDe = new Map<string, number>(((soldes ?? []) as { compte_id: string; solde: number }[]).map(s => [s.compte_id, Number(s.solde)]))
    const dernierRappro = new Map<string, { date_rapprochement: string; ecart: number }>()
    for (const r of rappro ?? []) if (!dernierRappro.has(r.compte_id)) dernierRappro.set(r.compte_id, r)
    const entrepotsOuverts = new Set((sessions ?? []).map(s => s.warehouse_id))

    const actifs = (comptes ?? []).filter(c => c.est_actif)
    const total  = actifs.reduce((a, c) => a + (soldeDe.get(c.id) ?? 0), 0)
    const choix: CompteChoix[] = actifs.map(c => ({ ...c, type: c.type as TypeCompte, solde: soldeDe.get(c.id) ?? 0 }))

    const etatDe = (c: { id: string; type: string; warehouse_id: string | null }) => {
        const r = dernierRappro.get(c.id)
        if (c.type === 'caisse' && c.warehouse_id && entrepotsOuverts.has(c.warehouse_id)) return { texte: 'Session ouverte', classe: 'bg-accent text-accent-foreground' }
        if (r && Number(r.ecart) !== 0) return { texte: `Écart ${formatF(Number(r.ecart))}`, classe: 'bg-[var(--rouge-doux)] text-[var(--rouge-texte)]' }
        if (r) return { texte: `Rapproché le ${new Date(r.date_rapprochement + 'T12:00:00').toLocaleDateString('fr-FR')}`, classe: 'bg-[var(--primary-soft)] text-[var(--primary-strong)]' }
        return null
    }

    return (
        <div className="flex flex-col min-h-screen">
            <EnTetePage
                titre="Comptes de trésorerie"
                sousTitre="Caisses, banques, Mobile Money et TPE : le solde de chaque compte et son journal."
                ariane={[{ label: 'Finances' }, { label: 'Trésorerie' }]}
                actions={peutGerer ? <ActionsListeTresorerie comptes={choix} /> : undefined}
            />

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 space-y-5">
                <section aria-label="Totaux" className="grid gap-3 grid-cols-2 lg:grid-cols-5">
                    <div className="col-span-2 lg:col-span-1 rounded-2xl p-5 bg-[var(--nav)] text-white">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#A9B7DD]">Total disponible</p>
                        <p className="titre-design text-2xl sm:text-3xl font-bold tabular-nums mt-1">{formatF(total)}</p>
                    </div>
                    {TYPES_COMPTE.map(t => {
                        const duType = actifs.filter(c => c.type === t)
                        return (
                            <div key={t} className="rounded-2xl p-5 bg-card border border-border">
                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{LIBELLES_TYPE[t]} ({duType.length})</p>
                                <p className="titre-design text-xl font-bold tabular-nums mt-1">
                                    {formatF(duType.reduce((a, c) => a + (soldeDe.get(c.id) ?? 0), 0))}
                                </p>
                            </div>
                        )
                    })}
                </section>

                <section aria-label="Comptes" className="rounded-2xl bg-card border border-border divide-y divide-border">
                    {TYPES_COMPTE.map(t => {
                        const duType = (comptes ?? []).filter(c => c.type === t)
                        if (duType.length === 0) return null
                        const Icone = ICONES[t]
                        return (
                            <div key={t} className="px-4 sm:px-5 py-3">
                                <div className="flex items-center justify-between pt-2 pb-1">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{LIBELLES_TYPE[t]}</h2>
                                    <span className="text-xs font-bold text-muted-foreground tabular-nums">
                                        {formatF(duType.filter(c => c.est_actif).reduce((a, c) => a + (soldeDe.get(c.id) ?? 0), 0))}
                                    </span>
                                </div>
                                <ul>
                                    {duType.map(c => {
                                        const solde = soldeDe.get(c.id) ?? 0
                                        const etat = etatDe(c)
                                        return (
                                            <li key={c.id}>
                                                <Link href={`/compta/tresorerie/${c.id}`}
                                                      className="flex flex-wrap items-center gap-3 sm:gap-4 rounded-xl px-2 py-3 hover:bg-muted transition-colors">
                                                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${PASTILLES[t]}`}>
                                                        <Icone className="w-5 h-5" aria-hidden="true" />
                                                    </span>
                                                    <span className="flex-1 min-w-[180px]">
                                                        <span className="block font-semibold text-[15px]">
                                                            {c.nom}{!c.est_actif && <span className="ml-2 text-xs font-medium text-muted-foreground">(désactivé)</span>}
                                                        </span>
                                                        <span className="block text-xs text-muted-foreground">{c.public_id}{c.numero ? ` · ${c.numero}` : ''}</span>
                                                    </span>
                                                    {etat && <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${etat.classe}`}>{etat.texte}</span>}
                                                    <span className={`titre-design text-lg font-bold tabular-nums ${solde < 0 ? 'text-[var(--rouge-texte)]' : ''}`}>{formatF(solde)}</span>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                                </Link>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        )
                    })}
                    {(comptes ?? []).length === 0 && (
                        <p className="p-8 text-center text-sm text-muted-foreground">Aucun compte : créez un entrepôt (sa caisse est créée avec) ou un compte banque / Mobile Money.</p>
                    )}
                </section>
            </main>
        </div>
    )
}
