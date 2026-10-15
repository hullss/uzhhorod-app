param([string]$MavenRepository = (Join-Path $env:USERPROFILE '.m2/repository'))
$ErrorActionPreference = 'Stop'
$newsRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$newsOutput = Join-Path $newsRoot 'target/news-parser-check'
$newsJdk = 'C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot/bin'
$newsJars = @(
    'org/junit/jupiter/junit-jupiter-api/5.12.2/junit-jupiter-api-5.12.2.jar',
    'org/assertj/assertj-core/3.27.7/assertj-core-3.27.7.jar',
    'org/opentest4j/opentest4j/1.3.0/opentest4j-1.3.0.jar',
    'org/apiguardian/apiguardian-api/1.1.2/apiguardian-api-1.1.2.jar'
) | ForEach-Object { Join-Path $MavenRepository $_ }
foreach ($newsJar in $newsJars) { if (!(Test-Path -LiteralPath $newsJar)) { throw "Missing cached test dependency: $newsJar. Run the regular Maven tests instead." } }
New-Item -ItemType Directory -Path $newsOutput -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $newsOutput 'news') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $newsRoot 'src/test/resources/news/council-article.html') -Destination (Join-Path $newsOutput 'news/council-article.html') -Force
$newsDependencies = Join-Path $newsOutput 'dependencies'
New-Item -ItemType Directory -Path $newsDependencies -Force | Out-Null
$newsLocalJars = foreach ($newsJar in $newsJars) {
    $newsLocalJar = Join-Path $newsDependencies ([System.IO.Path]::GetFileName($newsJar))
    Copy-Item -LiteralPath $newsJar -Destination $newsLocalJar -Force
    $newsLocalJar
}
$newsClasspath = $newsLocalJars -join [System.IO.Path]::PathSeparator
$newsSources = @(
    'src/main/java/ua/uzhhorod/digital/cityservices/news/api/OfficialNewsArticleResponse.java',
    'src/main/java/ua/uzhhorod/digital/cityservices/news/api/OfficialNewsItemResponse.java',
    'src/main/java/ua/uzhhorod/digital/cityservices/news/application/OfficialArticleExtractor.java',
    'src/main/java/ua/uzhhorod/digital/cityservices/news/application/OfficialNewsParser.java',
    'src/test/java/ua/uzhhorod/digital/cityservices/news/application/OfficialNewsParserTest.java',
    'scripts/NewsParserCheck.java'
) | ForEach-Object { Join-Path $newsRoot $_ }
& (Join-Path $newsJdk 'javac.exe') -encoding UTF-8 -cp $newsClasspath -d $newsOutput @newsSources
if ($LASTEXITCODE -ne 0) { throw 'Parser compilation failed' }
& (Join-Path $newsJdk 'java.exe') '-Djava.awt.headless=true' '-Dstdout.encoding=UTF-8' -cp ($newsOutput + [System.IO.Path]::PathSeparator + $newsClasspath) ua.uzhhorod.digital.cityservices.news.application.NewsParserCheck
if ($LASTEXITCODE -ne 0) { throw 'Parser checks failed' }
