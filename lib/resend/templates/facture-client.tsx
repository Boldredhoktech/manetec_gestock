import * as React from 'react'

interface Props {
    nomBoutique:    string
    nomClient:      string
    factureId:      string
    montantTTC:     number
    dateEcheance:   string | null
    urlFacture:     string
    devise:         string
    messagePersonnalise?: string
}

function fmt(n: number, d: string) {
    return new Intl.NumberFormat('fr-FR').format(n) + ' ' + d
}

export function EmailFactureClient({
                                       nomBoutique, nomClient, factureId, montantTTC,
                                       dateEcheance, urlFacture, devise, messagePersonnalise,
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

                        {/* HEADER */}
                        <tr>
                            <td style={{
                                background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)',
                                padding: '32px 40px',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🧾</div>
                                <h1 style={{ color: '#ffffff', margin: 0, fontSize: '22px', fontWeight: 800 }}>
                                    Votre facture
                                </h1>
                                <p style={{ color: 'rgba(255,255,255,0.85)', margin: '8px 0 0', fontSize: '14px' }}>
                                    {nomBoutique}
                                </p>
                            </td>
                        </tr>

                        {/* CORPS */}
                        <tr>
                            <td style={{ padding: '32px 40px' }}>
                                <p style={{ color: '#0f172a', fontSize: '15px', margin: '0 0 20px' }}>
                                    Bonjour <strong>{nomClient}</strong>,
                                </p>
                                <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>
                                    Veuillez trouver ci-dessous votre facture émise par <strong>{nomBoutique}</strong>.
                                    Le PDF est joint à cet email.
                                </p>

                                {/* CARTE FACTURE */}
                                <table width="100%" cellPadding={0} cellSpacing={0} style={{
                                    backgroundColor: '#f0f5ff',
                                    border: '1px solid #c7d7f9',
                                    borderRadius: '10px',
                                    marginBottom: '24px',
                                }}>
                                    <tr>
                                        <td style={{ padding: '22px 26px' }}>
                                            {[
                                                { label: 'N° Facture',  val: factureId },
                                                { label: 'Montant TTC', val: fmt(montantTTC, devise), gras: true },
                                                { label: 'Échéance',    val: dateEcheance ?? 'À réception' },
                                            ].map(item => (
                                                <table key={item.label} width="100%" cellPadding={0} cellSpacing={0}
                                                       style={{ marginBottom: '10px' }}>
                                                    <tr>
                                                        <td style={{ color: '#64748b', fontSize: '12px', width: '120px' }}>
                                                            {item.label}
                                                        </td>
                                                        <td style={{
                                                            color: item.gras ? '#15335a' : '#0f172a',
                                                            fontSize: item.gras ? '18px' : '14px',
                                                            fontWeight: item.gras ? 800 : 600,
                                                        }}>
                                                            {item.val}
                                                        </td>
                                                    </tr>
                                                </table>
                                            ))}
                                        </td>
                                    </tr>
                                </table>

                                {messagePersonnalise && (
                                    <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
                                        <tr>
                                            <td style={{
                                                backgroundColor: '#f8fafc',
                                                borderLeft: '3px solid #15335a',
                                                padding: '14px 18px',
                                                borderRadius: '0 8px 8px 0',
                                            }}>
                                                <p style={{ color: '#475569', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>
                                                    {messagePersonnalise}
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                )}

                                {/* BOUTON */}
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                    <tr>
                                        <td align="center">
                                            <a href={urlFacture} style={{
                                                display: 'inline-block',
                                                backgroundColor: '#15335a',
                                                color: '#ffffff',
                                                fontWeight: 700,
                                                fontSize: '14px',
                                                textDecoration: 'none',
                                                padding: '13px 32px',
                                                borderRadius: '8px',
                                            }}>
                                                Voir la facture en ligne →
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