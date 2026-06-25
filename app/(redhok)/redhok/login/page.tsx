import type { Metadata } from 'next'
import Image from 'next/image'
import { ShieldCheck, Store, Users, BarChart3, AlertTriangle } from 'lucide-react'
import FormulaireConnexionPlateforme from '@/components/redhok/FormulaireConnexionPlateforme'

export const metadata: Metadata = {
    title: 'Accès Plateforme — Manetec Inter BJ',
}

// Toujours dynamique : jamais de rendu en cache de la page de connexion
export const dynamic = 'force-dynamic'

export default async function PageConnexionPlateforme({
    searchParams,
}: {
    searchParams: Promise<{ inactif?: string }>
}) {
    const { inactif } = await searchParams
    return (
        <main className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-[#0f2742]">

            {/* ── Panneau gauche : branding (caché sur mobile) ── */}
            <section className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 text-white"
                     style={{ background: 'linear-gradient(160deg, #1a3d68 0%, #15335a 55%, #0f2742 100%)' }}>
                {/* halos animés */}
                <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#ef5e22]/20 blur-3xl animate-pulse" />
                <div className="pointer-events-none absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-[#1a56db]/20 blur-3xl" />

                <div className="relative z-10 flex items-center gap-3 animate-fade-down">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-lg">
                        <Image src="/logo/app_logo.png" alt="Manetec Gestock" width={36} height={36} className="object-contain" />
                    </span>
                    <div>
                        <p className="text-lg font-black leading-none">Manetec Inter BJ</p>
                        <p className="text-xs text-white/60 mt-1">Console Plateforme</p>
                    </div>
                </div>

                <div className="relative z-10 space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-semibold animate-fade-up">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#ef5e22]" />
                        Accès réservé à l'équipe Manetec Inter BJ
                    </div>
                    <h1 className="text-3xl font-black leading-tight animate-fade-up animate-delay-1">
                        Pilotez toutes les boutiques<br />
                        <span className="text-[#ef5e22]">depuis une seule console.</span>
                    </h1>
                    <div className="grid grid-cols-1 gap-3 max-w-sm">
                        {[
                            { icone: Store,     t: 'Gérer les boutiques et leurs licences' },
                            { icone: Users,     t: 'Gérer vos agents et leurs accès' },
                            { icone: BarChart3, t: 'Suivre l\'activité et l\'usage de chaque boutique' },
                        ].map(({ icone: I, t }, i) => (
                            <div key={i} className={`flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm animate-fade-up animate-delay-${i + 2}`}>
                                <I className="w-4 h-4 text-[#ef5e22] shrink-0" />
                                <span className="text-white/85">{t}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="relative z-10 text-xs text-white/40">© {new Date().getFullYear()} Manetec Inter BJ · Bold Redhok Tech</p>
            </section>

            {/* ── Panneau droit : formulaire ── */}
            <section className="flex min-h-screen items-center justify-center p-6 sm:p-10 bg-background">
                <div className="w-full max-w-md animate-fade-up">
                    {/* Logo visible sur mobile uniquement */}
                    <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15335a] shadow">
                            <Image src="/logo/app_logo.png" alt="Manetec Gestock" width={30} height={30} className="object-contain" />
                        </span>
                        <span className="text-lg font-black text-[#15335a]">Manetec Inter BJ</span>
                    </div>
                    {inactif === '1' && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3.5 py-3 text-sm mb-5">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>Vous avez été déconnecté après 10 heures d'inactivité. Reconnectez-vous.</span>
                        </div>
                    )}
                    <FormulaireConnexionPlateforme />
                </div>
            </section>

            <style>{`
                @keyframes fadeUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
                @keyframes fadeDown { from { opacity: 0; transform: translateY(-16px) } to { opacity: 1; transform: none } }
                .animate-fade-up { animation: fadeUp .6s ease both }
                .animate-fade-down { animation: fadeDown .6s ease both }
                .animate-delay-1 { animation-delay: .1s }
                .animate-delay-2 { animation-delay: .2s }
                .animate-delay-3 { animation-delay: .3s }
                .animate-delay-4 { animation-delay: .4s }
            `}</style>
        </main>
    )
}
