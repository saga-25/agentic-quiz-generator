# auto-commit-large-changes.ps1
# This script checks the current git diff and auto-commits if changes > 100 lines.

# Get stats for both staged and unstaged changes
$stats = git diff HEAD --shortstat
if ($null -eq $stats -or $stats -eq "") {
    # If no diff with HEAD, check if there are untracked files that would add many lines
    $untracked = git ls-files --others --exclude-standard
    if ($null -eq $untracked -or $untracked -eq "") {
        Write-Host "No changes detected."
        exit 0
    }
    $stats = "untracked files present"
}

# Accurate line count including untracked files
$insertions = 0
$deletions = 0

# Count tracked changes
$diffStats = git diff HEAD --numstat
if ($null -ne $diffStats) {
    foreach ($line in $diffStats) {
        if ($line -match "^(\d+)\s+(\d+)\s+") {
            $insertions += [int]$Matches[1]
            $deletions += [int]$Matches[2]
        }
    }
}

# Count lines in untracked files
$untrackedFiles = git ls-files --others --exclude-standard
foreach ($file in $untrackedFiles) {
    if (Test-Path $file) {
        $lineCount = (Get-Content $file | Measure-Object -Line).Lines
        $insertions += $lineCount
    }
}

$totalChanges = $insertions + $deletions

Write-Host "Detected $totalChanges line changes ($insertions insertions, $deletions deletions)."

if ($totalChanges -gt 100) {
    Write-Host "Changes exceed 100 lines. Auto-committing..."
    git add -A
    git commit -m "chore: auto-commit large change (>$totalChanges lines)"
    Write-Host "Auto-commit complete."
} else {
    Write-Host "Changes ($totalChanges lines) are within the 100-line threshold. No auto-commit performed."
}
