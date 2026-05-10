import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    serverExternalPackages: ['argon2', '@react-pdf/renderer'],
    experimental: {
        serverActions: {
            allowedOrigins: ['localhost:3000'],
        },
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
        ],
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            // Ces packages ne doivent jamais être bundlés côté client
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