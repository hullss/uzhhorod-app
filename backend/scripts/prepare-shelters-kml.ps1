#requires -Version 7.0
param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [string]$SourceUrl = 'https://www.google.com/maps/d/viewer?mid=1gHojIW_Zjs_qPe4Aqr_W3OPAjY2t69ym',
    [string]$LayerName = 'Укриття м. Ужгорода'
)
$ErrorActionPreference = 'Stop'
$settings = [System.Xml.XmlReaderSettings]::new()
$settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$settings.XmlResolver = $null
$reader = [System.Xml.XmlReader]::Create((Resolve-Path -LiteralPath $InputPath).Path, $settings)
$document = [System.Xml.XmlDocument]::new()
$document.XmlResolver = $null
try { $document.Load($reader) } finally { $reader.Dispose() }
$ns = [System.Xml.XmlNamespaceManager]::new($document.NameTable)
$ns.AddNamespace('k', 'http://www.opengis.net/kml/2.2')
$folder = @($document.SelectNodes('//k:Folder', $ns) | Where-Object { $_.SelectSingleNode('k:name', $ns).InnerText -eq $LayerName })
if ($folder.Count -ne 1) { throw 'Expected one shelter layer. Routes and other layers must not be imported as shelters.' }
$points = [Collections.Generic.List[object]]::new()
$review = [Collections.Generic.List[object]]::new()
$seen = [Collections.Generic.HashSet[string]]::new()
$culture = [Globalization.CultureInfo]::InvariantCulture
$sha = [Security.Cryptography.SHA256]::Create()
try {
    foreach ($place in $folder[0].SelectNodes('k:Placemark', $ns)) {
        $name = ($place.SelectSingleNode('k:name', $ns).InnerText -replace '\s+', ' ').Trim()
        $coordinateNode = $place.SelectSingleNode('k:Point/k:coordinates', $ns)
        $reason = $null
        if (!$coordinateNode) { $reason = 'Не точка: полігон або лінія. Потрібна підтверджена координата входу.' }
        elseif ($name -match '^Точка\s*\d+$' -or ($name -notmatch '\d|б\s*/\s*н')) { $reason = 'У назві немає повної адреси; потрібне уточнення.' }
        if ($reason) { $review.Add([ordered]@{ name = $name; reason = $reason; sourceGeometry = $place.OuterXml }); continue }
        $parts = $coordinateNode.InnerText.Trim().Split(',')
        $lon = [double]::Parse($parts[0], $culture); $lat = [double]::Parse($parts[1], $culture)
        if (![double]::IsFinite($lat) -or ![double]::IsFinite($lon) -or $lat -lt 48.56 -or $lat -gt 48.70 -or $lon -lt 22.16 -or $lon -gt 22.42) {
            $review.Add([ordered]@{ name = $name; reason = 'Координати поза межами валідатора редактора.'; latitude = $lat; longitude = $lon }); continue
        }
        $identity = "$name`n$($lat.ToString('R', $culture))`n$($lon.ToString('R', $culture))"
        $hash = [Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($identity))).ToLowerInvariant()
        $id = 'mymaps-' + $hash.Substring(0, 24)
        if (!$seen.Add($id)) { $review.Add([ordered]@{ name = $name; reason = 'Повний дублікат назви та координати.' }); continue }
        $address = $name
        if ($name -match '(?i)(?:^|[\s,–-])((?:вул\.?|вулиця|улица|пл\.|площа|площадь|проспект|провулок)\s*.+)$') { $address = $Matches[1] }
        $descriptionNode = $place.SelectSingleNode('k:description', $ns)
        $sourceDescription = if ($descriptionNode) { ([System.Net.WebUtility]::HtmlDecode(($descriptionNode.InnerText -replace '<[^>]+>', ' ')) -replace '\s+', ' ').Trim() } else { '' }
        $description = if ($sourceDescription) { "За описом джерела: $sourceDescription. " } else { '' }
        $description += 'Адресу й позначку перенесено з карти. Назви вулиць збережено як у джерелі. Точний вхід, режим роботи та доступність на місці не перевірені.'
        $points.Add([ordered]@{
            id = $id; name = $name; address = $address; latitude = $lat; longitude = $lon
            description = $description; sourceUrl = $SourceUrl
        })
    }
} finally { $sha.Dispose() }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$encoding = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'shelters-import.json'), (ConvertTo-Json -Depth 8 -InputObject @{ items = @($points.ToArray()) }), $encoding)
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'shelters-review.json'), (ConvertTo-Json -Depth 8 -InputObject @{ items = @($review.ToArray()) }), $encoding)
$summary = [ordered]@{
    sourceUrl = $SourceUrl; fetchedAt = [DateTimeOffset]::UtcNow.ToString('o'); layer = $LayerName
    sourceCount = $folder[0].SelectNodes('k:Placemark', $ns).Count
    readyForEditorialValidation = $points.Count; requireReview = $review.Count
    verifiedAtAssigned = $false; published = $false
}
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'shelters-import-summary.json'), (ConvertTo-Json -InputObject $summary), $encoding)
$summary | ConvertTo-Json
