# fix_solde_du.ps1
# Remplace toutes les occurrences de "solde_dû" par "solde_du" dans les fichiers .ts et .tsx

$files = Get-ChildItem -Path "." -Recurse -Include "*.ts","*.tsx" |
         Where-Object { $_.FullName -notmatch "node_modules|\.next" }

$count = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($content -match "solde_dû") {
        $newContent = $content -replace "solde_dû", "solde_du"
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8 -NoNewline
        Write-Host "✔ Modifié : $($file.FullName)"
        $count++
    }
}

if ($count -eq 0) {
    Write-Host "Aucun fichier contenant 'solde_dû' trouvé."
} else {
    Write-Host ""
    Write-Host "$count fichier(s) corrigé(s)."
}