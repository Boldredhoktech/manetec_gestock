// app/(shop)/compta/tresorerie/page.tsx
// Comptes de trésorerie (mig 041) : où se trouve l'argent, et combien.

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Landmark, Smartphone, Banknote, CreditCard, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aPermission, peutVoirSoldes } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { LIBELLES_TYPE, TYPES_COMPTE, formatF, type CompteChoix, type TypeCompte } from '@/lib/tresorerie/comptes'
import {
    FormulaireNouveauCompte, FormulaireVirement, FormulaireOperationProprietaire,
} from '@/components/shop/tresorerie/FormulairesTresorerie'

export const metadata: Metadata = { title: 'Trésorerie' }

const ICONES: Record<TypeCompte, React.ElementType> = {
    caisse: Banknote, mobile_money: Smartphone, banque: Landmark, tpe: CreditCard,
}

export default async function PageTresorerie() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!peutVoirSoldes(user)) redirect('/admin/dashboard')
    const peutGerer = aPermission(user, PERMISSIONS.TRESORERIE_GERER)

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: comptes }, { data: soldes }, { data: rappro }] = await Promise.all([
        adminClient.from('comptes_tresorerie')
            .select('id, public_id, type, nom, operateur, numero, warehouse_id, est_actif')
            .eq('shop_id', shopId).order('nom'),
        adminClient.rpc('soldes_comptes', { p_shop_id: shopId }),
        adminClient.from('rapprochements_tresorerie')
            .select('compte_id, date_rapprochement, ecart')
            .eq('shop_id', shopId).order('date_rapprochement', { ascending: false }),
    ])

    const soldeDe = new Map<string, number>(((soldes ?? []) as { compte_id: string; solde: number }[])
        .map(s => [s.compte_id, Number(s.solde)]))
    const dernierRappro = new Map<string, { date_rapprochement: string; ecart: number }>()
    for (const r of rappro ?? []) if (!dernierRappro.has(r.compte_id)) dernierRappro.set(r.compte_id, r)

    const actifs = (comptes ?? []).filter(c => c.est_actif)
    const total  = actifs.reduce((a, c) => a + (soldeDe.get(c.id) ?? 0), 0)
    const choix: CompteChoix[] = actifs.map(c => ({ ...c, type: c.type as TypeCompte, solde: soldeDe.get(c.id) ?? 0 }))

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Trésorerie</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Caisses, banques, Mobile Money et TPE : le solde de chaque compte et son journal.
                </p>
            </header>

            <main className="flex-1 p-4 sm:p-6 space-y-6">
                <section aria-label="Totaux" className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="col-span-2 lg:col-span-1 rounded-xl p-4 bg-[#0B1F4D] text-white">
                        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Total disponible</p>
                        <p className="text-2xl font-bold tabular-nums mt-1">{formatF(total)}</p>
                    </div>
                    {TYPES_COMPTE.map(t => {
                        const duType = actifs.filter(c => c.type === t)
                        return (
                            <div key={t} className="rounded-xl p-4 bg-card border border-border">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{LIBELLES_TYPE[t]} ({duType.length})</p>
                                <p className="text-lg font-bold tabular-nums mt-1">
                                    {formatF(duType.reduce((a, c) => a + (soldeDe.get(c.id) ?? 0), 0))}
                                </p>
                            </div>
                        )
                    })}
                </section>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <section aria-label="Comptes" className="flex-1 min-w-0 w-full bg-card border border-border rounded-xl divide-y divide-border">
                        {TYPES_COMPTE.map(t => {
                            const duType = (comptes ?? []).filter(c => c.type === t)
                            if (duType.length === 0) return null
                            const Icone = ICONES[t]
                            return (
                                <div key={t} className="p-4 space-y-1">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1">{LIBELLES_TYPE[t]}</h2>
                                    {duType.map(c => {
                                        const solde = soldeDe.get(c.id) ?? 0
                                        const r = dernierRappro.get(c.id)
                                        return (
                                            <Link key={c.id} href={`/compta/tresorerie/${c.id}`}
                                                  className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted transition-colors">
                                                <span className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                    <Icone className="w-5 h-5 text-foreground" aria-hidden="true" />
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block font-semibold text-sm truncate">
                                                        {c.nom}{!c.est_actif && <span className="ml-2 text-xs font-medium text-muted-foreground">(désactivé)</span>}
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        {c.public_id}{c.numero ? ` · ${c.numero}` : ''}
                                                        {r ? ` · rapproché le ${new Date(r.date_rapprochement).toLocaleDateString('fr-FR')}` : ''}
                                                        {r && Number(r.ecart) !== 0 ? ` (écart ${formatF(Number(r.ecart))})` : ''}
                                                    </span>
                                                </span>
                                                <span className={`font-bold tabular-nums text-sm ${solde < 0 ? 'text-destructive' : ''}`}>{formatF(solde)}</span>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                            </Link>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </section>

                    {peutGerer && (
                        <aside className="w-full lg:w-[380px] space-y-3">
                            <details className="bg-card border border-border rounded-xl p-4 group" open>
                                <summary className="cursor-pointer font-semibold text-sm">Virement entre comptes</summary>
                                <div className="pt-4">
                                    {choix.length >= 2
                                        ? <FormulaireVirement comptes={choix} />
                                        : <p className="text-sm text-muted-foreground">Il faut au moins deux comptes actifs.</p>}
                                </div>
                            </details>
                            <details className="bg-card border border-border rounded-xl p-4">
                                <summary className="cursor-pointer font-semibold text-sm">Retrait ou apport du propriétaire</summary>
                                <div className="pt-4"><FormulaireOperationProprietaire comptes={choix} /></div>
                            </details>
                            <details className="bg-card border border-border rounded-xl p-4">
                                <summary className="cursor-pointer font-semibold text-sm">Nouveau compte (banque, Mobile Money, TPE)</summary>
                                <div className="pt-4"><FormulaireNouveauCompte banques={choix.filter(c => c.type === 'banque')} /></div>
                            </details>
                        </aside>
                    )}
                </div>
            </main>
        </div>
    )
}
