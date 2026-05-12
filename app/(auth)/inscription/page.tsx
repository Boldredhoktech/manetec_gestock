// app/(auth)/inscription/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import FormulaireInscription from '@/components/auth/FormulaireInscription'
import { ENTREPRISE } from '@/lib/config/entreprise'

export const metadata: Metadata = {
    title: `Créer ma boutique — ${ENTREPRISE.produit}`,
    description: ENTREPRISE.description,
}

export default function PageInscription() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f0f4ff 0%, #ffffff 50%, #f0fdf4 100%)',
            display: 'flex',
            flexDirection: 'column',
        }}>

            {/* Navbar minimaliste */}
            <nav style={{
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #e2e8f0',
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
            }}>
                <Link href="/" style={{
                    display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                }}>
                    <div style={{
                        width: 36, height: 36,
                        background: 'linear-gradient(135deg, #1a56db, #1648c0)',
                        borderRadius: 9, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 900, fontSize: 13, color: '#fff',
                    }}>MG</div>
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                        {ENTREPRISE.produit}
                    </span>
                </Link>
                <Link href="/login" style={{
                    fontSize: 14, fontWeight: 600, color: '#1a56db', textDecoration: 'none',
                }}>
                    J'ai déjà un compte →
                </Link>
            </nav>

            {/* Corps */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '40px 24px 60px',
                gap: 48,
            }}>

                {/* Colonne gauche — argumentaire */}
                <div style={{ maxWidth: 380, paddingTop: 16, display: 'none' }}
                     className="inscription-left-col">
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px', background: '#dbeafe',
                        borderRadius: 100, marginBottom: 20,
                    }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1a56db', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            30 jours gratuits
                        </span>
                    </div>
                    <h1 style={{
                        fontSize: 32, fontWeight: 900, color: '#0f172a',
                        lineHeight: 1.2, letterSpacing: -1, margin: '0 0 16px',
                    }}>
                        Ouvrez votre boutique en 2 minutes
                    </h1>
                    <p style={{
                        fontSize: 16, color: '#64748b', lineHeight: 1.7, margin: '0 0 32px',
                    }}>
                        Aucune installation, aucune carte bancaire. Commencez gratuitement
                        et découvrez pourquoi +500 boutiques font confiance à Manetec Gestock.
                    </p>
                    {[
                        '✓ Caisse POS moderne et rapide',
                        '✓ Gestion de stock en temps réel',
                        '✓ Factures A4 professionnelles',
                        '✓ Rapports et analyses',
                        '✓ Support inclus',
                    ].map(item => (
                        <p key={item} style={{
                            fontSize: 14, color: '#475569', margin: '0 0 10px',
                            fontWeight: 600,
                        }}>{item}</p>
                    ))}
                </div>

                {/* Formulaire */}
                <div style={{
                    width: '100%',
                    maxWidth: 520,
                    background: '#fff',
                    borderRadius: 24,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                }}>

                    {/* En-tête formulaire */}
                    <div style={{
                        background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)',
                        padding: '28px 32px',
                    }}>
                        <h2 style={{
                            fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 6px',
                        }}>
                            Créer ma boutique gratuitement
                        </h2>
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
                            30 jours d'essai · Aucune carte requise · Activation immédiate
                        </p>
                    </div>

                    {/* Formulaire */}
                    <div style={{ padding: '32px' }}>
                        <FormulaireInscription />
                    </div>
                </div>
            </div>

        </div>
    )
}