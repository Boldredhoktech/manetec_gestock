import * as React from 'react'
import { ENTREPRISE } from '@/lib/config/entreprise'

// Avis envoyé une fois après la mig 040 (connexion sans ShopId) :
// au propriétaire de chaque boutique, la liste de TOUS ses comptes,
// ancien → nouvel identifiant, pour qu'il la relaie à son équipe.

export interface CompteRenomme {
    nomComplet: string
    role:       string
    ancien:     string
    nouveau:    string
}

interface Props {
    nomBoutique:     string
    nomProprietaire: string
    comptes:         CompteRenomme[]
    urlConnexion:    string
    finTransition:   string   // ex. « 31 janvier 2027 »
}

const LIBELLES_ROLES: Record<string, string> = {
    super_admin_boutique: 'Propriétaire',
    admin_boutique:       'Administrateur',
    vendeur:              'Vendeur',
    stock_manager:        'Gestionnaire de stock',
    comptable:            'Comptable',
}

export function EmailNouveauxIdentifiants({
    nomBoutique, nomProprietaire, comptes, urlConnexion, finTransition,
}: Props) {
    const plusieurs = comptes.length > 1
    return (
        <html>
        <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style={{ fontFamily: "'Segoe UI', Arial, sans-serif", backgroundColor: '#f8fafc', margin: 0, padding: 0 }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ padding: '32px 0' }}>
            <tr>
                <td align="center">
                    <table width="580" cellPadding={0} cellSpacing={0} style={{
                        backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '100%',
                    }}>

                        {/* EN-TÊTE */}
                        <tr>
                            <td style={{ background: '#0B1F4D', padding: '32px 40px', textAlign: 'center' }}>
                                <h1 style={{ color: '#ffffff', margin: 0, fontSize: '22px', fontWeight: 800 }}>
                                    Vos identifiants de connexion changent
                                </h1>
                                <p style={{ color: 'rgba(255,255,255,0.8)', margin: '8px 0 0', fontSize: '14px' }}>
                                    {nomBoutique} · Manetec Gestock
                                </p>
                            </td>
                        </tr>

                        {/* CORPS */}
                        <tr>
                            <td style={{ padding: '32px 40px' }}>
                                <p style={{ color: '#0f172a', fontSize: '16px', margin: '0 0 12px' }}>
                                    Bonjour <strong>{nomProprietaire}</strong>,
                                </p>
                                <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', margin: '0 0 12px' }}>
                                    Pour simplifier la connexion, l&apos;<strong>ID boutique</strong> (SHOP-…) n&apos;est
                                    plus demandé. Chaque compte se connecte désormais avec un identifiant qui contient
                                    le nom de votre boutique, et son mot de passe habituel.
                                </p>
                                <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>
                                    {plusieurs
                                        ? <>Voici les nouveaux identifiants de <strong>tous les comptes</strong> de votre boutique. Merci de les transmettre à chaque membre de votre équipe.</>
                                        : <>Voici votre nouvel identifiant.</>}
                                    {' '}<strong>Les mots de passe ne changent pas.</strong>
                                </p>

                                {/* TABLEAU DES COMPTES */}
                                <table width="100%" cellPadding={0} cellSpacing={0} style={{
                                    border: '1px solid #c7d7f9', borderRadius: '10px', marginBottom: '24px',
                                    borderCollapse: 'separate', overflow: 'hidden',
                                }}>
                                    <tr style={{ backgroundColor: '#E8EEFF' }}>
                                        <td style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Compte</td>
                                        <td style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nouvel identifiant</td>
                                    </tr>
                                    {comptes.map(c => (
                                        <tr key={c.nouveau}>
                                            <td style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{c.nomComplet}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                    {LIBELLES_ROLES[c.role] ?? c.role} · avant : <span style={{ fontFamily: 'monospace' }}>{c.ancien}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                                                <span style={{
                                                    fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#0f172a',
                                                    backgroundColor: '#FEF6C7', padding: '4px 8px', borderRadius: '6px',
                                                    wordBreak: 'break-all',
                                                }}>
                                                    {c.nouveau}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </table>

                                {/* BOUTON */}
                                <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
                                    <tr>
                                        <td align="center">
                                            <a href={urlConnexion} style={{
                                                display: 'inline-block', backgroundColor: '#1D4ED8', color: '#ffffff',
                                                fontWeight: 700, fontSize: '15px', textDecoration: 'none',
                                                padding: '14px 36px', borderRadius: '8px',
                                            }}>
                                                Se connecter →
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                {/* TRANSITION */}
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                    <tr>
                                        <td style={{ backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '14px 18px' }}>
                                            <p style={{ color: '#334155', fontSize: '13px', lineHeight: '1.55', margin: 0 }}>
                                                Jusqu&apos;au <strong>{finTransition}</strong>, l&apos;ancien identifiant reste accepté :
                                                un bandeau rappelle alors le nouveau après la connexion. Passé cette date,
                                                seul le nouvel identifiant fonctionnera.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        {/* PIED */}
                        <tr>
                            <td style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '20px 40px', textAlign: 'center' }}>
                                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                                    Une question ? {ENTREPRISE.nom} sur WhatsApp : {ENTREPRISE.whatsapp}
                                </p>
                                <p style={{ color: '#94a3b8', fontSize: '11px', margin: '4px 0 0' }}>
                                    {ENTREPRISE.nom} · Manetec Gestock
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
