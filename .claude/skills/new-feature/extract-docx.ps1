# Extracts the text of a .docx (paragraphs, table cells joined with " | ") to a UTF-8 .txt file.
# Works while the .docx is open in Word: the file is copied with shared read access first.
# Usage: powershell -NoProfile -File extract-docx.ps1 -Source <file.docx> -Out <file.txt>
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Out
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$copy = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName() + ".docx")
$in = [System.IO.File]::Open($Source, "Open", "Read", "ReadWrite")
$outStream = [System.IO.File]::Create($copy)
try { $in.CopyTo($outStream) } finally { $outStream.Close(); $in.Close() }

try {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($copy)
  try {
    $entry = $zip.Entries | Where-Object { $_.FullName -eq "word/document.xml" }
    $reader = New-Object System.IO.StreamReader($entry.Open())
    $xml = $reader.ReadToEnd()
    $reader.Close()
  } finally { $zip.Dispose() }
} finally { Remove-Item $copy -Force }

$text = $xml -replace "</w:p>", "`n" -replace "<w:tab/>", "`t" -replace "</w:tc>", " | " -replace "<[^>]+>", ""
$text = [System.Net.WebUtility]::HtmlDecode($text)
$lines = $text -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" -and $_ -ne "|" }

New-Item -ItemType Directory -Force (Split-Path -Parent $Out) | Out-Null
$lines | Out-File -Encoding utf8 $Out
"Wrote $($lines.Count) lines to $Out"
