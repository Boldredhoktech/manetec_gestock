import { useEffect } from 'react'

export function useDebounce(
    valeur: string,
    delai: number,
    callback: (v: string) => void
) {
    useEffect(() => {
        const timer = setTimeout(() => callback(valeur), delai)
        return () => clearTimeout(timer)
    }, [valeur, delai, callback])
}