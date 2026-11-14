import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import './landing.css'

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
})

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
})

// Polices du logiciel (nouveau design, 14/11) : Inter pour le texte,
// Space Grotesk pour les titres. Appliquées par la classe .app-manetec
// (app/(shop)/layout.tsx) : la page publique et la connexion gardent Geist.
const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' })
const spaceGrotesk = Space_Grotesk({ variable: '--font-space', subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap' })

export const metadata: Metadata = {
    title: {
        default: 'Manetec Gestock',
        template: '%s | Manetec Gestock',
    },
    description: 'Système de gestion de stock et de vente — Manetec Gestock',
}

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    return (
        <html lang="fr" suppressHydrationWarning>
        <body
            className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${spaceGrotesk.variable} antialiased`}
        >
        {children}
        </body>
        </html>
    )
}