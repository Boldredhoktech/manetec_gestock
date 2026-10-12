// lib/auth/mot-de-passe-temporaire.ts
// Mot de passe remis au propriétaire d'une boutique à sa création ou à
// une réinitialisation. Tiré de randomBytes (Math.random n'est pas un
// générateur cryptographique), sans les signes ambigus 0/O, 1/l/I.

import { randomBytes } from 'node:crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

export function motDePasseTemporaire(longueur = 10): string {
    return Array.from(randomBytes(longueur), o => ALPHABET[o % ALPHABET.length]).join('')
}
