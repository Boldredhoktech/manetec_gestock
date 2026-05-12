import * as React from 'react'

interface Props {
    nomBoutique:     string
    nomProprietaire: string
    estActive:       boolean
    motif?:          string
    urlApp:          string
}

export function EmailStatutBoutique({
                                        nomBoutique, nomProprietaire, estActive, motif, urlApp,
                                    }: Props) {
    const couleurHeader = estActive ? '#16a34a' : '#dc2626'
    const emoji = estActive ? '✅' : '🔴'

    return (
        <html>
        <body style={{
            fontFamily: "'Segoe UI', Arial, sans-serif",
            backgroundColor: '#f8fafc',
            margin: 0, padding: 0,
        }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ padding: '40px 0' }}>
            <tr>
                <td align="center">
                    <table width="580" cellPadding={0} cellSpacing={0} style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                    }}>

                        {/* HEADER */}
                        <tr>
                            <td style={{
                                background: `linear-gradient(135deg, ${couleurHeader} 0%, ${estActive ? '#15803d' : '#b91c1c'} 100%)`,
                                padding: '32px 40px',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '40px', marginBottom: '12px' }}>{emoji}</div>
                                <h1 style={{
                                    color: '#ffffff', margin: 0,
                                    fontSize: '22px', fontWeight: 800,
                                }}>
                                    Boutique {estActive ? 'réactivée' : 'désactivée'}
                                </h1>
                            </td>
                        </tr>

                        {/* CORPS */}
                        <tr>
                            <td style={{ padding: '32px 40px' }}>
                                <p style={{ color: '#0f172a', fontSize: '15px', margin: '0 0 20px' }}>
                                    Bonjour <strong>{nomProprietaire}</strong>,
                                </p>

                                <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
                                    <tr>
                                        <td style={{
                                            backgroundColor: estActive ? '#f0fdf4' : '#fef2f2',
                                            border: `1px solid ${estActive ? '#86efac' : '#fca5a5'}`,
                                            borderRadius: '10px',
                                            padding: '20px 24px',
                                        }}>
                                            <p style={{
                                                color: estActive ? '#166534' : '#991b1b',
                                                fontSize: '14px', margin: '0 0 10px', fontWeight: 700,
                                            }}>
                                                {estActive
                                                    ? `Votre boutique "${nomBoutique}" a été réactivée avec succès.`
                                                    : `Votre boutique "${nomBoutique}" a été désactivée.`
                                                }
                                            </p>
                                            <p style={{
                                                color: estActive ? '#166534' : '#991b1b',
                                                fontSize: '13px', margin: 0,
                                            }}>
                                                {estActive
                                                    ? 'Tous vos utilisateurs peuvent à nouveau se connecter normalement.'
                                                    : 'Aucun de vos utilisateurs ne peut se connecter pendant cette période.'
                                                }
                                            </p>
                                        </td>
                                    </tr>
                                </table>

                                {motif && (
                                    <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
                                        <tr>
                                            <td style={{
                                                backgroundColor: '#f8fafc',
                                                borderRadius: '8px',
                                                padding: '16px 20px',
                                            }}>
                                                <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 6px', fontWeight: 600 }}>
                                                    MOTIF COMMUNIQUÉ
                                                </p>
                                                <p style={{ color: '#0f172a', fontSize: '14px', margin: 0 }}>
                                                    {motif}
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                )}

                                {estActive && (
                                    <table width="100%" cellPadding={0} cellSpacing={0}>
                                        <tr>
                                            <td align="center">
                                                <a href={urlApp} style={{
                                                    display: 'inline-block',
                                                    backgroundColor: '#1a56db',
                                                    color: '#ffffff',
                                                    fontWeight: 700,
                                                    fontSize: '14px',
                                                    textDecoration: 'none',
                                                    padding: '13px 32px',
                                                    borderRadius: '8px',
                                                }}>
                                                    Accéder à ma boutique →
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                )}

                                {!estActive && (
                                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '16px' }}>
                                        Pour toute question, contactez Manetec Inter BJ via votre canal habituel
                                        ou par email à <strong>support@manetec.app</strong>.
                                    </p>
                                )}
                            </td>
                        </tr>

                        {/* FOOTER */}
                        <tr>
                            <td style={{
                                backgroundColor: '#f8fafc',
                                borderTop: '1px solid #e2e8f0',
                                padding: '18px 40px',
                                textAlign: 'center',
                            }}>
                                <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                                    Manetec Inter BJ · Manetec Gestock
                                </p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
        </body>
        </html>
    )
}