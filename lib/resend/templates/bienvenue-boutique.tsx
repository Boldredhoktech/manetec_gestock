import * as React from 'react'

interface Props {
    nomBoutique:   string
    shopPublicId:  string
    identifiant:   string
    motDePasse:    string
    nomProprietaire: string
    urlApp:        string
}

export function EmailBienvenueBoutions({
                                           nomBoutique, shopPublicId, identifiant,
                                           motDePasse, nomProprietaire, urlApp,
                                       }: Props) {
    return (
        <html>
        <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
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

                        {/* HEADER BLEU ROI */}
                        <tr>
                            <td style={{
                                background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)',
                                padding: '36px 40px',
                                textAlign: 'center',
                            }}>
                                <div style={{
                                    display: 'inline-block',
                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                    borderRadius: '50%',
                                    width: '60px', height: '60px',
                                    lineHeight: '60px',
                                    fontSize: '28px',
                                    marginBottom: '16px',
                                }}>🏪</div>
                                <h1 style={{
                                    color: '#ffffff', margin: 0,
                                    fontSize: '24px', fontWeight: 800,
                                    letterSpacing: '-0.5px',
                                }}>
                                    Bienvenue sur Manetec Gestock
                                </h1>
                                <p style={{ color: 'rgba(255,255,255,0.8)', margin: '8px 0 0', fontSize: '14px' }}>
                                    Propulsé par Bold Redhok Tech
                                </p>
                            </td>
                        </tr>

                        {/* CORPS */}
                        <tr>
                            <td style={{ padding: '36px 40px' }}>
                                <p style={{ color: '#0f172a', fontSize: '16px', margin: '0 0 8px' }}>
                                    Bonjour <strong>{nomProprietaire}</strong>,
                                </p>
                                <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', margin: '0 0 28px' }}>
                                    Votre boutique <strong style={{ color: '#1a56db' }}>{nomBoutique}</strong> a été
                                    créée avec succès sur la plateforme Manetec Gestock. Vous trouverez ci-dessous
                                    vos identifiants de connexion. Conservez-les précieusement.
                                </p>

                                {/* CARTE CREDENTIALS */}
                                <table width="100%" cellPadding={0} cellSpacing={0} style={{
                                    backgroundColor: '#f0f5ff',
                                    border: '1px solid #c7d7f9',
                                    borderRadius: '10px',
                                    marginBottom: '28px',
                                }}>
                                    <tr>
                                        <td style={{ padding: '24px 28px' }}>
                                            <p style={{
                                                color: '#1a56db', fontSize: '11px', fontWeight: 700,
                                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                                margin: '0 0 16px',
                                            }}>
                                                🔑 Vos identifiants de connexion
                                            </p>

                                            {[
                                                { label: 'ID Boutique',   val: shopPublicId,  mono: true  },
                                                { label: 'Identifiant',   val: identifiant,   mono: true  },
                                                { label: 'Mot de passe',  val: motDePasse,    mono: true  },
                                            ].map(item => (
                                                <table key={item.label} width="100%" cellPadding={0} cellSpacing={0}
                                                       style={{ marginBottom: '10px' }}>
                                                    <tr>
                                                        <td style={{
                                                            color: '#64748b', fontSize: '12px',
                                                            fontWeight: 600, width: '130px',
                                                        }}>
                                                            {item.label}
                                                        </td>
                                                        <td style={{
                                                            color: '#0f172a', fontSize: '14px',
                                                            fontFamily: item.mono ? 'monospace' : 'inherit',
                                                            fontWeight: 700,
                                                            backgroundColor: item.mono ? '#e0eaff' : 'transparent',
                                                            padding: item.mono ? '4px 10px' : '0',
                                                            borderRadius: '6px',
                                                        }}>
                                                            {item.val}
                                                        </td>
                                                    </tr>
                                                </table>
                                            ))}
                                        </td>
                                    </tr>
                                </table>

                                {/* BOUTON */}
                                <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '28px' }}>
                                    <tr>
                                        <td align="center">
                                            <a href={urlApp} style={{
                                                display: 'inline-block',
                                                backgroundColor: '#1a56db',
                                                color: '#ffffff',
                                                fontWeight: 700,
                                                fontSize: '15px',
                                                textDecoration: 'none',
                                                padding: '14px 36px',
                                                borderRadius: '8px',
                                            }}>
                                                Se connecter maintenant →
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                {/* ALERTE MOT DE PASSE */}
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                    <tr>
                                        <td style={{
                                            backgroundColor: '#fef3c7',
                                            border: '1px solid #fcd34d',
                                            borderRadius: '8px',
                                            padding: '14px 18px',
                                        }}>
                                            <p style={{ color: '#92400e', fontSize: '13px', margin: 0 }}>
                                                ⚠️ <strong>Important :</strong> Changez votre mot de passe dès votre
                                                première connexion pour sécuriser votre compte.
                                            </p>
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
                                padding: '20px 40px',
                                textAlign: 'center',
                            }}>
                                <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                                    Bold Redhok Tech · Manetec Gestock
                                </p>
                                <p style={{ color: '#94a3b8', fontSize: '11px', margin: '4px 0 0' }}>
                                    Cet email a été envoyé automatiquement. Ne pas répondre.
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