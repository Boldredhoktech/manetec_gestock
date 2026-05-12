// app/(auth)/login/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import FormulaireConnexionBoutique from '@/components/shared/FormulaireConnexionBoutique'
import { ENTREPRISE } from '@/lib/config/entreprise'

export const metadata: Metadata = {
    title: `Connexion — ${ENTREPRISE.produit}`,
}

export default function PageLoginBoutique() {
    return (
        <div className="login-root">

            {/* Arrière-plan animé */}
            <div className="login-bg">
                <div className="login-orb login-orb-1" />
                <div className="login-orb login-orb-2" />
                <div className="login-orb login-orb-3" />
                <div className="login-grid" />
            </div>

            {/* Panneau gauche — branding */}
            <div className="login-left">
                <div className="login-left-content">

                    {/* Logo */}
                    <Link href="/" className="login-logo-link">
                        <div className="login-logo-icon">MG</div>
                        <div>
                            <p className="login-logo-produit">{ENTREPRISE.produit}</p>
                            <p className="login-logo-par">par {ENTREPRISE.nom}</p>
                        </div>
                    </Link>

                    {/* Tagline */}
                    <div className="login-tagline">
                        <h1 className="login-tagline-title">
                            Gérez. Vendez.
                            <br />
                            <span className="login-tagline-accent">Prospérez.</span>
                        </h1>
                        <p className="login-tagline-desc">
                            Votre outil de gestion commerciale tout-en-un.
                            Caisse, stock, facturation et bien plus.
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="login-stats">
                        {[
                            { val: '500+', label: 'Boutiques actives' },
                            { val: '8',    label: 'Pays'              },
                            { val: '99.9%',label: 'Disponibilité'     },
                        ].map(s => (
                            <div key={s.label} className="login-stat">
                                <span className="login-stat-val">{s.val}</span>
                                <span className="login-stat-label">{s.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Lien vers la landing */}
                    <Link href="/" className="login-back-link">
                        ← Retour à l'accueil
                    </Link>
                </div>
            </div>

            {/* Panneau droit — formulaire */}
            <div className="login-right">
                <div className="login-form-wrapper">

                    <div className="login-form-header">
                        <h2 className="login-form-title">Connexion à votre boutique</h2>
                        <p className="login-form-subtitle">
                            Entrez votre identifiant de boutique et vos credentials
                        </p>
                    </div>

                    <FormulaireConnexionBoutique />

                    <div className="login-form-footer">
                        <p>Pas encore de boutique ?</p>
                        <Link href="/inscription" className="login-inscription-link">
                            Créer ma boutique gratuitement →
                        </Link>
                    </div>
                </div>
            </div>

            <style>{`
                .login-root {
                    min-height: 100vh;
                    display: flex;
                    position: relative;
                    overflow: hidden;
                    font-family: 'Plus Jakarta Sans', 'Outfit', -apple-system, sans-serif;
                }

                /* ── Arrière-plan ───────────────────────────── */
                .login-bg {
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                }

                .login-orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(70px);
                    opacity: 0.3;
                    animation: loginFloat 10s ease-in-out infinite;
                }

                .login-orb-1 {
                    width: 500px; height: 500px;
                    background: radial-gradient(circle, #93c5fd, transparent);
                    top: -200px; left: -100px;
                    animation-delay: 0s;
                }

                .login-orb-2 {
                    width: 400px; height: 400px;
                    background: radial-gradient(circle, #c7d2fe, transparent);
                    bottom: -100px; right: -50px;
                    animation-delay: 4s;
                }

                .login-orb-3 {
                    width: 200px; height: 200px;
                    background: radial-gradient(circle, #fde68a, transparent);
                    top: 50%; left: 45%;
                    animation-delay: 7s;
                    opacity: 0.15;
                }

                .login-grid {
                    position: absolute;
                    inset: 0;
                    background-image:
                        linear-gradient(to right,  rgba(26,86,219,0.04) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(26,86,219,0.04) 1px, transparent 1px);
                    background-size: 48px 48px;
                }

                @keyframes loginFloat {
                    0%, 100% { transform: translateY(0) scale(1);        }
                    50%       { transform: translateY(-24px) scale(1.04); }
                }

                /* ── Panneau gauche ─────────────────────────── */
                .login-left {
                    display: none;
                    flex: 1;
                    background: linear-gradient(155deg, #1a56db 0%, #1e3a8a 50%, #0f172a 100%);
                    position: relative;
                    z-index: 1;
                    padding: 48px;
                    align-items: center;
                    justify-content: center;
                }

                @media (min-width: 1024px) {
                    .login-left { display: flex; }
                }

                .login-left-content {
                    max-width: 420px;
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 40px;
                }

                .login-logo-link {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    text-decoration: none;
                }

                .login-logo-icon {
                    width: 48px; height: 48px;
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    font-weight: 900;
                    color: #fff;
                    letter-spacing: -0.5px;
                    backdrop-filter: blur(8px);
                }

                .login-logo-produit {
                    font-size: 18px;
                    font-weight: 800;
                    color: #fff;
                    margin: 0;
                    line-height: 1;
                }

                .login-logo-par {
                    font-size: 12px;
                    color: rgba(255,255,255,0.6);
                    margin: 3px 0 0;
                }

                .login-tagline { }

                .login-tagline-title {
                    font-size: 48px;
                    font-weight: 900;
                    color: #fff;
                    line-height: 1.1;
                    letter-spacing: -2px;
                    margin: 0 0 16px;
                }

                .login-tagline-accent {
                    background: linear-gradient(135deg, #fbbf24, #f59e0b);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .login-tagline-desc {
                    font-size: 16px;
                    color: rgba(255,255,255,0.7);
                    line-height: 1.7;
                    margin: 0;
                }

                .login-stats {
                    display: flex;
                    gap: 0;
                    background: rgba(255,255,255,0.07);
                    border: 1px solid rgba(255,255,255,0.12);
                    border-radius: 16px;
                    overflow: hidden;
                    backdrop-filter: blur(8px);
                }

                .login-stat {
                    flex: 1;
                    padding: 20px 16px;
                    text-align: center;
                    border-right: 1px solid rgba(255,255,255,0.12);
                }

                .login-stat:last-child { border-right: none; }

                .login-stat-val {
                    display: block;
                    font-size: 24px;
                    font-weight: 900;
                    color: #fff;
                    letter-spacing: -0.5px;
                }

                .login-stat-label {
                    display: block;
                    font-size: 11px;
                    color: rgba(255,255,255,0.55);
                    margin-top: 4px;
                }

                .login-back-link {
                    font-size: 14px;
                    color: rgba(255,255,255,0.5);
                    text-decoration: none;
                    transition: color 0.15s;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }

                .login-back-link:hover { color: rgba(255,255,255,0.9); }

                /* ── Panneau droit ──────────────────────────── */
                .login-right {
                    flex: none;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 32px 24px;
                    background: rgba(255,255,255,0.92);
                    backdrop-filter: blur(20px);
                    position: relative;
                    z-index: 1;
                }

                @media (min-width: 1024px) {
                    .login-right {
                        width: 480px;
                        flex-shrink: 0;
                        border-left: 1px solid rgba(26,86,219,0.1);
                    }
                }

                .login-form-wrapper {
                    width: 100%;
                    max-width: 400px;
                    display: flex;
                    flex-direction: column;
                    gap: 28px;
                    animation: loginSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
                }

                @keyframes loginSlideIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0);     }
                }

                .login-form-header { text-align: center; }

                .login-form-title {
                    font-size: 26px;
                    font-weight: 900;
                    color: #0f172a;
                    letter-spacing: -0.5px;
                    margin: 0 0 8px;
                }

                .login-form-subtitle {
                    font-size: 14px;
                    color: #64748b;
                    margin: 0;
                    line-height: 1.6;
                }

                .login-form-footer {
                    text-align: center;
                    padding-top: 16px;
                    border-top: 1px solid #e2e8f0;
                }

                .login-form-footer p {
                    font-size: 13px;
                    color: #94a3b8;
                    margin: 0 0 8px;
                }

                .login-inscription-link {
                    font-size: 14px;
                    font-weight: 700;
                    color: #1a56db;
                    text-decoration: none;
                    transition: color 0.15s;
                }

                .login-inscription-link:hover {
                    color: #1648c0;
                    text-decoration: underline;
                }
            `}</style>
        </div>
    )
}