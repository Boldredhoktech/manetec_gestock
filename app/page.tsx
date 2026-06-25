// app/page.tsx
// Landing page publique — Manetec Gestock
import './landing.css'
import Link from 'next/link'
import Image from 'next/image'
import { Phone, MessageSquare, Mail, MapPin, Star } from 'lucide-react'
import { ENTREPRISE } from '@/lib/config/entreprise'

function LogoEntreprise({ className }: { className?: string }) {
    if (ENTREPRISE.logos.logos_actifs) {
        return (
            <div className="landing-logo">
                <Image
                    src={ENTREPRISE.logos.application}
                    alt={ENTREPRISE.produit}
                    width={40}
                    height={40}
                    className={className}
                    style={{ objectFit: 'contain', borderRadius: 8 }}
                    priority
                />
                <div>
                    <span className="landing-logo-produit">{ENTREPRISE.produit}</span>
                    <span className="landing-logo-par">par {ENTREPRISE.nom}</span>
                </div>
            </div>
        )
    }
    return (
        <div className="landing-logo">
            <div className="landing-logo-icon">MG</div>
            <div>
                <span className="landing-logo-produit">{ENTREPRISE.produit}</span>
                <span className="landing-logo-par">par {ENTREPRISE.nom}</span>
            </div>
        </div>
    )
}

export default function LandingPage() {
    return (
        <div className="landing-root">

            {/* ── NAVBAR ───────────────────────────────────────── */}
            <nav className="landing-nav">
                <div className="landing-container landing-nav-inner">
                    <Link href="/" style={{ textDecoration: 'none' }}>
                        <LogoEntreprise />
                    </Link>
                    <div className="landing-nav-links">
                        <a href="#fonctionnalites" className="landing-nav-link">Fonctionnalités</a>
                        <a href="#plans"           className="landing-nav-link">Tarifs</a>
                        <a href="#temoignages"     className="landing-nav-link">Témoignages</a>
                        <a href="#contact"         className="landing-nav-link">Contact</a>
                    </div>
                    <div className="landing-nav-actions">
                        <Link href="/login"       className="landing-btn-outline">Mon espace</Link>
                        <Link href="/inscription" className="landing-btn-primary">Ouvrir ma boutique</Link>
                    </div>
                </div>
            </nav>

            {/* ── HERO ─────────────────────────────────────────── */}
            <section className="landing-hero">
                <div className="landing-hero-bg">
                    <div className="landing-hero-orb orb-1" />
                    <div className="landing-hero-orb orb-2" />
                    <div className="landing-hero-orb orb-3" />
                    <div className="landing-hero-grid" />
                </div>
                <div className="landing-container landing-hero-content">
                    <div className="landing-hero-badge animate-fade-up">
                        <span className="landing-hero-badge-dot" />
                        Solution N°1 de gestion commerciale en Afrique
                    </div>
                    <h1 className="landing-hero-title animate-fade-up animate-delay-1">
                        Gérez votre boutique
                        <span className="landing-hero-title-accent"> comme un pro</span>
                    </h1>
                    <p className="landing-hero-desc animate-fade-up animate-delay-2">
                        {ENTREPRISE.description}
                        <br />Caisse POS, stock, factures, fournisseurs et comptabilité — tout en un.
                    </p>
                    <div className="landing-hero-actions animate-fade-up animate-delay-3">
                        <Link href="/inscription" className="landing-btn-hero-primary">
                            <span>Ouvrir ma boutique gratuitement</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </Link>
                        <Link href="/login" className="landing-btn-hero-secondary">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Accéder à mon espace
                        </Link>
                    </div>
                    <p className="landing-hero-note animate-fade-up animate-delay-4">
                        ✓ 30 jours gratuits &nbsp;·&nbsp; ✓ Aucune carte requise &nbsp;·&nbsp; ✓ Installation en 2 minutes
                    </p>
                </div>

                {/* Dashboard mockup */}
                <div className="landing-hero-mockup animate-fade-up animate-delay-3">
                    <div className="landing-mockup-window">
                        <div className="landing-mockup-bar">
                            <span className="dot red"/>
                            <span className="dot yellow"/>
                            <span className="dot green"/>
                            <span className="landing-mockup-url">manetec.app/admin/dashboard</span>
                        </div>
                        <div className="landing-mockup-body">
                            <div className="landing-mockup-sidebar">
                                {['Dashboard','Caisse POS','Produits','Clients','Factures','Rapports'].map((item, i) => (
                                    <div key={item} className={`landing-mockup-nav-item ${i === 0 ? 'active' : ''}`}>
                                        <span className="landing-mockup-nav-dot" />
                                        {item}
                                    </div>
                                ))}
                            </div>
                            <div className="landing-mockup-main">
                                <div className="landing-mockup-header">Tableau de bord · Aujourd'hui</div>
                                <div className="landing-mockup-stats">
                                    {[
                                        { label: 'Ventes',   val: '347 000', unit: 'FCFA',      color: '#15335a' },
                                        { label: 'Clients',  val: '28',      unit: 'ce jour',   color: '#059669' },
                                        { label: 'En stock', val: '1 204',   unit: 'articles',  color: '#d97706' },
                                        { label: 'Factures', val: '12',      unit: 'en attente', color: '#7c3aed' },
                                    ].map(s => (
                                        <div key={s.label} className="landing-mockup-stat" style={{ borderTopColor: s.color }}>
                                            <span className="landing-mockup-stat-val" style={{ color: s.color }}>{s.val}</span>
                                            <span className="landing-mockup-stat-unit">{s.unit}</span>
                                            <span className="landing-mockup-stat-label">{s.label}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="landing-mockup-chart">
                                    {[40,65,45,80,55,90,70,85,60,95,75,88].map((h, i) => (
                                        <div key={i} className="landing-mockup-bar-item"
                                             style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── STATS ────────────────────────────────────────── */}
            <section className="landing-stats">
                <div className="landing-container landing-stats-grid">
                    {ENTREPRISE.statistiques.map(s => (
                        <div key={s.label} className="landing-stat-item">
                            <span className="landing-stat-val">{s.valeur}</span>
                            <span className="landing-stat-label">{s.label}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FONCTIONNALITÉS ──────────────────────────────── */}
            <section id="fonctionnalites" className="landing-section">
                <div className="landing-container">
                    <div className="landing-section-header">
                        <span className="landing-section-tag">Fonctionnalités</span>
                        <h2 className="landing-section-title">Tout ce dont votre boutique a besoin</h2>
                        <p className="landing-section-desc">
                            Une solution complète, pensée pour les réalités des PME africaines.
                        </p>
                    </div>
                    <div className="landing-features-grid">
                        {ENTREPRISE.fonctionnalites_cles.map((f, i) => {
                            const Icone = f.icone
                            return (
                            <div key={i} className="landing-feature-card">
                                <div className="landing-feature-icon"><Icone size={26} strokeWidth={2} /></div>
                                <h3 className="landing-feature-title">{f.titre}</h3>
                                <p className="landing-feature-desc">{f.description}</p>
                            </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ── PLANS ────────────────────────────────────────── */}
            <section id="plans" className="landing-section landing-section-dark">
                <div className="landing-container">
                    <div className="landing-section-header">
                        <span className="landing-section-tag light">Tarifs</span>
                        <h2 className="landing-section-title light">
                            Commencez gratuitement, évoluez quand vous voulez
                        </h2>
                        <p className="landing-section-desc light">
                            30 jours d'essai gratuit sur le plan Starter. Passez au plan Pro ou Enterprise quand votre activité grandit.
                        </p>
                    </div>
                    <div className="landing-plans-grid">
                        {ENTREPRISE.plans.map((plan) => (
                            <div key={plan.id}
                                 className={`landing-plan-card ${(plan as any).populaire ? 'popular' : ''}`}>
                                {(plan as any).populaire && (
                                    <div className="landing-plan-badge">
                                        <Star size={14} fill="currentColor" style={{ verticalAlign: '-2px' }} /> Plus populaire
                                    </div>
                                )}
                                <div className="landing-plan-header" style={{ borderTopColor: plan.couleur }}>
                                    <h3 className="landing-plan-nom">{plan.nom}</h3>
                                    <p className="landing-plan-desc">{plan.description}</p>

                                    {/* Prix configurables depuis entreprise.ts */}
                                    <div className="landing-plan-prix">
                                        <span className="landing-plan-prix-val" style={{ color: plan.couleur }}>
                                            {plan.prix_affiche}
                                        </span>
                                        <span className="landing-plan-prix-duree">
                                            {(plan as any).prix_mensuel > 0
                                                ? `${plan.devise_prix} / ${plan.duree}`
                                                : plan.duree
                                            }
                                        </span>
                                    </div>
                                </div>
                                <ul className="landing-plan-features">
                                    {plan.fonctionnalites.map((f, i) => (
                                        <li key={i} className="landing-plan-feature">
                                            <svg className="landing-plan-check" style={{ color: plan.couleur }}
                                                 width="16" height="16" viewBox="0 0 24 24"
                                                 fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="20 6 9 17 4 12"/>
                                            </svg>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={plan.id === 'starter' ? '/inscription' : `https://wa.me/${ENTREPRISE.whatsapp.replace(/\s/g,'')}`}
                                    target={plan.id !== 'starter' ? '_blank' : undefined}
                                    rel={plan.id !== 'starter' ? 'noopener noreferrer' : undefined}
                                    className="landing-plan-btn"
                                    style={{
                                        background:  (plan as any).populaire ? plan.couleur : 'transparent',
                                        borderColor: plan.couleur,
                                        color:       (plan as any).populaire ? '#fff' : plan.couleur,
                                    }}
                                >
                                    {plan.cta}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── TÉMOIGNAGES ──────────────────────────────────── */}
            <section id="temoignages" className="landing-section">
                <div className="landing-container">
                    <div className="landing-section-header">
                        <span className="landing-section-tag">Témoignages</span>
                        <h2 className="landing-section-title">Ils font confiance à Manetec Gestock</h2>
                    </div>
                    <div className="landing-testimonials-grid">
                        {ENTREPRISE.temoignages.map((t, i) => (
                            <div key={i} className="landing-testimonial-card">
                                <div className="landing-testimonial-stars">
                                    {Array.from({ length: t.note }).map((_, s) => (
                                        <Star key={s} size={15} fill="currentColor" strokeWidth={0} />
                                    ))}
                                </div>
                                <p className="landing-testimonial-texte">"{t.texte}"</p>
                                <div className="landing-testimonial-auteur">
                                    <div className="landing-testimonial-avatar">{t.nom.charAt(0)}</div>
                                    <div>
                                        <p className="landing-testimonial-nom">{t.nom}</p>
                                        <p className="landing-testimonial-poste">{t.poste} · {t.ville}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA CENTRAL ──────────────────────────────────── */}
            <section className="landing-cta">
                <div className="landing-cta-bg">
                    <div className="landing-cta-orb" />
                </div>
                <div className="landing-container landing-cta-content">
                    <h2 className="landing-cta-title">Prêt à transformer votre gestion ?</h2>
                    <p className="landing-cta-desc">
                        Rejoignez plus de 500 boutiques qui font confiance à Manetec Gestock.
                        Démarrez gratuitement dès aujourd'hui.
                    </p>
                    <div className="landing-cta-actions">
                        <Link href="/inscription" className="landing-btn-hero-primary">
                            Ouvrir ma boutique gratuitement
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </Link>
                        <a href={`https://wa.me/${ENTREPRISE.whatsapp.replace(/\s/g,'')}`}
                           target="_blank" rel="noopener noreferrer"
                           className="landing-btn-whatsapp">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                        </a>
                    </div>
                </div>
            </section>

            {/* ── CONTACT ──────────────────────────────────────── */}
            <section id="contact" className="landing-section">
                <div className="landing-container">
                    <div className="landing-section-header">
                        <span className="landing-section-tag">Contact</span>
                        <h2 className="landing-section-title">Parlons de votre projet</h2>
                    </div>
                    <div className="landing-contact-grid">
                        <div className="landing-contact-info">
                            <h3 className="landing-contact-subtitle">{ENTREPRISE.nom}</h3>
                            <p className="landing-contact-desc">
                                Notre équipe est disponible pour vous accompagner dans la mise en place
                                de Manetec Gestock pour votre activité.
                            </p>
                            <div className="landing-contact-items">
                                <a href={`tel:${ENTREPRISE.telephone_1}`} className="landing-contact-item">
                                    <div className="landing-contact-item-icon"><Phone size={18} /></div>
                                    <div>
                                        <p className="landing-contact-item-label">Téléphone</p>
                                        <p className="landing-contact-item-val">{ENTREPRISE.telephone_1}</p>
                                        {ENTREPRISE.telephone_2 && (
                                            <p className="landing-contact-item-val">{ENTREPRISE.telephone_2}</p>
                                        )}
                                    </div>
                                </a>
                                <a href={`https://wa.me/${ENTREPRISE.whatsapp.replace(/\s/g,'')}`}
                                   target="_blank" rel="noopener noreferrer"
                                   className="landing-contact-item">
                                    <div className="landing-contact-item-icon"><MessageSquare size={18} /></div>
                                    <div>
                                        <p className="landing-contact-item-label">WhatsApp</p>
                                        <p className="landing-contact-item-val">{ENTREPRISE.whatsapp}</p>
                                    </div>
                                </a>
                                <a href={`mailto:${ENTREPRISE.email_contact}`} className="landing-contact-item">
                                    <div className="landing-contact-item-icon"><Mail size={18} /></div>
                                    <div>
                                        <p className="landing-contact-item-label">Email</p>
                                        <p className="landing-contact-item-val">{ENTREPRISE.email_contact}</p>
                                    </div>
                                </a>
                                <div className="landing-contact-item">
                                    <div className="landing-contact-item-icon"><MapPin size={18} /></div>
                                    <div>
                                        <p className="landing-contact-item-label">Adresse</p>
                                        <p className="landing-contact-item-val">
                                            {ENTREPRISE.quartier}, {ENTREPRISE.ville}, {ENTREPRISE.pays}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="landing-contact-card">
                            <h3 className="landing-contact-card-title">Démarrer maintenant</h3>
                            <p className="landing-contact-card-desc">
                                Ouvrez votre boutique en 2 minutes et bénéficiez de 30 jours d'essai gratuit.
                            </p>
                            <Link href="/inscription" className="landing-contact-cta">
                                Créer ma boutique gratuitement →
                            </Link>
                            <div className="landing-contact-separator">ou</div>
                            <Link href="/login" className="landing-contact-login">
                                J'ai déjà un compte — Me connecter
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ───────────────────────────────────────── */}
            <footer className="landing-footer">
                <div className="landing-container">
                    <div className="landing-footer-top">
                        <div>
                            {ENTREPRISE.logos.logos_actifs ? (
                                <div className="landing-logo" style={{ marginBottom: 12 }}>
                                    <Image
                                        src={ENTREPRISE.logos.application}
                                        alt={ENTREPRISE.produit}
                                        width={36}
                                        height={36}
                                        style={{ objectFit: 'contain', borderRadius: 8 }}
                                    />
                                    <div>
                                        <span className="landing-logo-produit" style={{ color: '#fff' }}>
                                            {ENTREPRISE.produit}
                                        </span>
                                        <span className="landing-logo-par">{ENTREPRISE.nom}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="landing-logo" style={{ marginBottom: 12 }}>
                                    <div className="landing-logo-icon small">MG</div>
                                    <div>
                                        <span className="landing-logo-produit" style={{ color: '#fff' }}>
                                            {ENTREPRISE.nom}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <p className="landing-footer-desc">{ENTREPRISE.slogan}</p>
                        </div>
                        <div className="landing-footer-links">
                            <div>
                                <p className="landing-footer-col-title">Produit</p>
                                <a href="#fonctionnalites" className="landing-footer-link">Fonctionnalités</a>
                                <a href="#plans"           className="landing-footer-link">Tarifs</a>
                                <Link href="/inscription"  className="landing-footer-link">Créer une boutique</Link>
                                <Link href="/login"        className="landing-footer-link">Se connecter</Link>
                            </div>
                            <div>
                                <p className="landing-footer-col-title">Contact</p>
                                <a href={`tel:${ENTREPRISE.telephone_1}`}         className="landing-footer-link">{ENTREPRISE.telephone_1}</a>
                                <a href={`mailto:${ENTREPRISE.email_contact}`}    className="landing-footer-link">{ENTREPRISE.email_contact}</a>
                                <p className="landing-footer-link">{ENTREPRISE.ville}, {ENTREPRISE.pays}</p>
                            </div>
                        </div>
                    </div>
                    <div className="landing-footer-bottom">
                        <p>© {new Date().getFullYear()} {ENTREPRISE.nom}. Tous droits réservés.</p>
                        <p>{ENTREPRISE.produit} — Solution de gestion commerciale</p>
                    </div>
                </div>
            </footer>

        </div>
    )
}