import * as React from 'react'

interface Props {
    nomBoutique:    string
    nomProprietaire: string
    plan:           string
    dateExpiration: string
    joursRestants:  number
    estExpire:      boolean
    urlContact:     string
}

const PLAN_LABELS: Record<string, string> = {
    starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
}

export function EmailAlerteAbonnement({
                                          nomBoutique, nomProprietaire, plan,
                                          dateExpiration, joursRestants, estExpire, urlContact,
                                      }: Props) {
    const couleur = estExpire ? '#dc2626' : joursRestants <= 3 ? '#d97706' : '#f59e0b'
    const fond    = estExpire ? '#fef2f2' : '#fefce8'
    const bordure = estExpire ? '#fca5a5' : '#fde68a'

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
                                background: estExpire
                                    ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                                    : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                padding: '32px 40px',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                                    {estExpire ? '🔴' : '⚠️'}
                                </div>
                                <h1 style={{
                                    color: '#ffffff', margin: 0,
                                    fontSize: '22px', fontWeight: 800,
                                }}>
                                    {estExpire
                                        ? 'Votre abonnement a expiré'
                                        : `Votre abonnement expire dans ${joursRestants} jour(s)`
                                    }
                                </h1>
                            </td>
                        </tr>

                        {/* CORPS */}
                        <tr>
                            <td style={{ padding: '32px 40px' }}>
                                <p style={{ color: '#0f172a', fontSize: '15px', margin: '0 0 20px' }}>
                                    Bonjour <strong>{nomProprietaire}</strong>,
                                </p>

                                {/* ALERTE */}
                                <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
                                    <tr>
                                        <td style={{
                                            backgroundColor: fond,
                                            border: `1px solid ${bordure}`,
                                            borderRadius: '10px',
                                            padding: '20px 24px',
                                        }}>
                                            <p style={{ color: couleur, fontSize: '14px', margin: '0 0 12px', fontWeight: 700 }}>
                                                {estExpire
                                                    ? `L'abonnement Plan ${PLAN_LABELS[plan] ?? plan} de votre boutique "${nomBoutique}" a expiré le ${dateExpiration}.`
                                                    : `L'abonnement Plan ${PLAN_LABELS[plan] ?? plan} de votre boutique "${nomBoutique}" expire le ${dateExpiration}.`
                                                }
                                            </p>
                                            <p style={{ color: '#78350f', fontSize: '13px', margin: 0 }}>
                                                {estExpire
                                                    ? 'Votre boutique a été suspendue. Contactez Bold Redhok Tech immédiatement pour régulariser votre situation.'
                                                    : 'Renouvelez votre abonnement avant cette date pour éviter toute interruption de service.'
                                                }
                                            </p>
                                        </td>
                                    </tr>
                                </table>

                                {/* INFO BOUTIQUE */}
                                <table width="100%" cellPadding={0} cellSpacing={0} style={{
                                    backgroundColor: '#f8fafc',
                                    borderRadius: '8px',
                                    marginBottom: '24px',
                                }}>
                                    <tr>
                                        <td style={{ padding: '16px 20px' }}>
                                            {[
                                                { label: 'Boutique',    val: nomBoutique },
                                                { label: 'Plan actuel', val: PLAN_LABELS[plan] ?? plan },
                                                { label: 'Expiration',  val: dateExpiration },
                                            ].map(item => (
                                                <table key={item.label} width="100%" cellPadding={0} cellSpacing={0}
                                                       style={{ marginBottom: '8px' }}>
                                                    <tr>
                                                        <td style={{ color: '#64748b', fontSize: '12px', width: '120px' }}>
                                                            {item.label}
                                                        </td>
                                                        <td style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600 }}>
                                                            {item.val}
                                                        </td>
                                                    </tr>
                                                </table>
                                            ))}
                                        </td>
                                    </tr>
                                </table>

                                {/* BOUTON */}
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                    <tr>
                                        <td align="center">
                                            <a href={urlContact} style={{
                                                display: 'inline-block',
                                                backgroundColor: '#15335a',
                                                color: '#ffffff',
                                                fontWeight: 700,
                                                fontSize: '14px',
                                                textDecoration: 'none',
                                                padding: '13px 32px',
                                                borderRadius: '8px',
                                            }}>
                                                Contactez Manetec Inter BJ →
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
                                    Manetec Inter BJ · Manetec Gestock · Support automatique
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