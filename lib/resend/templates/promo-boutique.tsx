import * as React from 'react'

interface Props {
    nomClient:      string
    nomBoutique:    string
    titre:          string
    message:        string
    urlApp:         string
    logoUrl?:       string
}

export function EmailPromoBoutique({
                                       nomClient, nomBoutique, titre, message, urlApp,
                                   }: Props) {
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

                        {/* HEADER DORÉ */}
                        <tr>
                            <td style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                padding: '36px 40px',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '44px', marginBottom: '14px' }}>🎁</div>
                                <h1 style={{
                                    color: '#ffffff', margin: 0,
                                    fontSize: '24px', fontWeight: 800,
                                }}>
                                    {titre}
                                </h1>
                                <p style={{ color: 'rgba(255,255,255,0.9)', margin: '8px 0 0', fontSize: '14px' }}>
                                    De la part de {nomBoutique}
                                </p>
                            </td>
                        </tr>

                        {/* CORPS */}
                        <tr>
                            <td style={{ padding: '36px 40px' }}>
                                <p style={{ color: '#0f172a', fontSize: '16px', margin: '0 0 20px' }}>
                                    Bonjour <strong>{nomClient}</strong> 👋
                                </p>

                                {/* MESSAGE */}
                                <div style={{
                                    color: '#334155', fontSize: '15px', lineHeight: '1.7',
                                    margin: '0 0 28px',
                                    whiteSpace: 'pre-line',
                                }}>
                                    {message}
                                </div>

                                {/* BOUTON */}
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                    <tr>
                                        <td align="center">
                                            <a href={urlApp} style={{
                                                display: 'inline-block',
                                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                                color: '#ffffff',
                                                fontWeight: 700,
                                                fontSize: '15px',
                                                textDecoration: 'none',
                                                padding: '14px 36px',
                                                borderRadius: '8px',
                                            }}>
                                                Découvrir →
                                            </a>
                                        </td>
                                    </tr>
                                </table>
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
                                    {nomBoutique} · Manetec Gestock
                                </p>
                                <p style={{ color: '#cbd5e1', fontSize: '11px', margin: '4px 0 0' }}>
                                    Vous recevez cet email car vous êtes client de {nomBoutique}.
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