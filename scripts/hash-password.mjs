import argon2 from 'argon2'

const motDePasse = 'BoldRedhok2026!'

const hash = await argon2.hash(motDePasse, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
})

console.log('Hash Argon2 :')
console.log(hash)