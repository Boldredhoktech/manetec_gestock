import type { NextConfig } from 'next'

const nextConfig: NextConfig = {

    serverExternalPackages: ['argon2', '@react-pdf/renderer'],

    experimental: {
        serverActions: {
            // ✅ Ajout du domaine de production en plus de localhost
            allowedOrigins: [
                'localhost:3000',
                'manetec.app',
                'www.manetec.app',
            ],
        },
    },

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                port:     '',
                pathname: '/storage/v1/object/public/**',
            },
        ],
    },

    // ── Empêche le cache stale après déploiement ───────────────
    // Résout l'erreur "Failed to find Server Action" côté client
    // quand le navigateur gardait une ancienne version en cache
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key:   'Cache-Control',
                        value: 'no-cache, no-store, must-revalidate',
                    },
                ],
            },
        ]
    },

    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs:     false,
                net:    false,
                tls:    false,
                crypto: false,
            }
        }
        return config
    },
}

export default nextConfig