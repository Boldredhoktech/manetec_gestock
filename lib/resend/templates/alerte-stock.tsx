import * as React from 'react'

interface ProduitAlerte {
    nom:          string
    public_id:    string
    stock:        number
    seuil_alerte: number
    unite:        string
    entrepot:     string
}

interface Props {
    nomBoutique:  string
    produits:     ProduitAlerte[]
    urlApp:       string
}

export function EmailAlerteStock({ nomBoutique, produits, urlApp }: Props) {
    const enRupture = produits.filter(p => p.stock <= 0)
    const enAlerte  = produits.filter(p => p.stock > 0 && p.stock <= p.seuil_alerte)

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
                                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                padding: '32px 40px',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📦</div>
                                <h1 style={{ color: '#ffffff', margin: 0, fontSize: '22px', fontWeight: 800 }}>
                                    Alerte de stock
                                </h1>
                                <p style={{ color: 'rgba(255,255,255,0.85)', margin: '8px 0 0', fontSize: '14px' }}>
                                    {nomBoutique} — {produits.length} produit(s) nécessitent votre attention
                                </p>
                            </td>
                        </tr>

                        {/* CORPS */}
                        <tr>
                            <td style={{ padding: '32px 40px' }}>

                                {/* RUPTURES */}
                                {enRupture.length > 0 && (
                                    <>
                                        <p style={{
                                            color: '#dc2626', fontSize: '13px', fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '0.05em',
                                            margin: '0 0 12px',
                                        }}>
                                            🚨 En rupture de stock ({enRupture.length})
                                        </p>
                                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
                                            {enRupture.map((p, i) => (
                                                <tr key={p.public_id} style={{
                                                    backgroundColor: i % 2 === 0 ? '#fef2f2' : '#fff5f5',
                                                }}>
                                                    <td style={{ padding: '10px 14px', borderRadius: i === 0 ? '8px 8px 0 0' : '0' }}>
                                                        <p style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>
                                                            {p.nom}
                                                        </p>
                                                        <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>
                                                            {p.public_id} · {p.entrepot}
                                                        </p>
                                                    </td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                <span style={{
                                    backgroundColor: '#fee2e2',
                                    color: '#dc2626',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    padding: '3px 10px',
                                    borderRadius: '20px',
                                }}>
                                  RUPTURE
                                </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </table>
                                    </>
                                )}

                                {/* EN ALERTE */}
                                {enAlerte.length > 0 && (
                                    <>
                                        <p style={{
                                            color: '#d97706', fontSize: '13px', fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '0.05em',
                                            margin: '0 0 12px',
                                        }}>
                                            ⚠️ Stock faible ({enAlerte.length})
                                        </p>
                                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
                                            {enAlerte.map((p, i) => (
                                                <tr key={p.public_id} style={{
                                                    backgroundColor: i % 2 === 0 ? '#fffbeb' : '#fef3c7',
                                                }}>
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <p style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>
                                                            {p.nom}
                                                        </p>
                                                        <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>
                                                            {p.public_id} · {p.entrepot}
                                                        </p>
                                                    </td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <span style={{
                                    color: '#d97706', fontWeight: 700, fontSize: '13px',
                                }}>
                                  {p.stock} {p.unite}
                                </span>
                                                        <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '6px' }}>
                                  / seuil : {p.seuil_alerte}
                                </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </table>
                                    </>
                                )}

                                {/* BOUTON */}
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                    <tr>
                                        <td align="center">
                                            <a href={`${urlApp}/stock/produits`} style={{
                                                display: 'inline-block',
                                                backgroundColor: '#15335a',
                                                color: '#ffffff',
                                                fontWeight: 700,
                                                fontSize: '14px',
                                                textDecoration: 'none',
                                                padding: '13px 32px',
                                                borderRadius: '8px',
                                            }}>
                                                Gérer le stock →
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
                                    Manetec Gestock · Alerte automatique de stock
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