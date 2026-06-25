// app/(auth)/login/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle } from 'lucide-react'
import FormulaireConnexionBoutique from '@/components/shared/FormulaireConnexionBoutique'
import { ENTREPRISE } from '@/lib/config/entreprise'

export const metadata: Metadata = {
    title: `Connexion — ${ENTREPRISE.produit}`,
}

export const dynamic = 'force-dynamic'

export default async function PageLoginBoutique({
    searchParams,
}: {
    searchParams: Promise<{ suspendu?: string; inactif?: string }>
}) {
    const { suspendu, inactif } = await searchParams
    const messageSuspension = suspendu === 'expire'
        ? 'L\'abonnement de votre boutique a expiré. Contactez Manetec Inter BJ pour le renouveler.'
        : suspendu === 'desactive'
            ? 'Votre boutique a été désactivée. Contactez Manetec Inter BJ.'
            : inactif === '1'
                ? 'Vous avez été déconnecté après 10 heures d\'inactivité. Reconnectez-vous.'
                : null

    return (
        <main className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-[#0f2742]">

            {/* ── Panneau gauche : flyer réel (caché sur mobile) ── */}
            <section className="relative hidden lg:block overflow-hidden"
                     style={{ background: 'linear-gradient(160deg, #1a3d68 0%, #15335a 55%, #0f2742 100%)' }}>
                <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#ef5e22]/15 blur-3xl animate-pulse" />
                <Image
                    src="/marketing/flyer-groupe.png"
                    alt="Manetec Gestock — gérez votre stock, développez votre business"
                    fill
                    priority
                    className="object-cover object-top animate-fade-in"
                />
                {/* léger voile pour la profondeur */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f2742]/40 via-transparent to-transparent" />
            </section>

            {/* ── Panneau droit : formulaire ── */}
            <section className="flex min-h-screen items-center justify-center p-6 sm:p-10 bg-background">
                <div className="w-full max-w-md animate-fade-up">

                    {/* Logo + titre */}
                    <div className="flex flex-col items-center text-center mb-6">
                        <Link href="/" className="flex items-center gap-2.5">
                            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow border border-border">
                                <Image src="/logo/app_logo.png" alt={ENTREPRISE.produit} width={34} height={34} className="object-contain" />
                            </span>
                            <span className="text-xl font-black text-[#15335a]">{ENTREPRISE.produit}</span>
                        </Link>
                        <h1 className="mt-5 text-2xl font-bold text-foreground">Connexion à votre boutique</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Entrez votre identifiant de boutique et vos accès
                        </p>
                    </div>

                    {messageSuspension && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3.5 py-3 text-sm mb-5">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{messageSuspension}</span>
                        </div>
                    )}

                    <FormulaireConnexionBoutique />

                    <div className="text-center mt-6 text-sm">
                        <p className="text-muted-foreground">Pas encore de boutique ?</p>
                        <Link href="/inscription" className="font-bold text-[#15335a] hover:text-[#ef5e22] transition-colors">
                            Créer ma boutique gratuitement →
                        </Link>
                    </div>
                    <div className="text-center mt-4">
                        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                            ← Retour à l'accueil
                        </Link>
                    </div>
                </div>
            </section>

            <style>{`
                @keyframes fadeUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
                @keyframes fadeIn { from { opacity: 0; transform: scale(1.04) } to { opacity: 1; transform: none } }
                .animate-fade-up { animation: fadeUp .6s ease both }
                .animate-fade-in { animation: fadeIn 1s ease both }
            `}</style>
        </main>
    )
}
