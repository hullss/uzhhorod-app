param([string]$MavenRepository = (Join-Path $env:USERPROFILE '.m2/repository'))
$ErrorActionPreference = 'Stop'
$editorialRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$editorialOutput = Join-Path $editorialRoot 'target/editorial-validator-check'
$editorialJdk = 'C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot/bin'
$editorialPaths = @(
    'com/fasterxml/jackson/core/jackson-databind/2.19.2/jackson-databind-2.19.2.jar',
    'com/fasterxml/jackson/core/jackson-core/2.19.2/jackson-core-2.19.2.jar',
    'com/fasterxml/jackson/core/jackson-annotations/2.19.2/jackson-annotations-2.19.2.jar',
    'org/springframework/spring-web/6.2.19/spring-web-6.2.19.jar',
    'org/springframework/spring-core/6.2.19/spring-core-6.2.19.jar',
    'org/springframework/spring-context/6.2.19/spring-context-6.2.19.jar',
    'org/springframework/spring-beans/6.2.19/spring-beans-6.2.19.jar',
    'org/springframework/spring-jcl/6.2.19/spring-jcl-6.2.19.jar',
    'org/springframework/data/spring-data-jpa/3.5.13/spring-data-jpa-3.5.13.jar',
    'org/springframework/data/spring-data-commons/3.5.13/spring-data-commons-3.5.13.jar',
    'jakarta/persistence/jakarta.persistence-api/3.1.0/jakarta.persistence-api-3.1.0.jar',
    'io/micrometer/micrometer-observation/1.15.12/micrometer-observation-1.15.12.jar',
    'io/micrometer/micrometer-commons/1.15.12/micrometer-commons-1.15.12.jar'
) | ForEach-Object { Join-Path $MavenRepository $_ }
foreach ($editorialJar in $editorialPaths) { if (!(Test-Path -LiteralPath $editorialJar)) { throw "Missing cached dependency: $editorialJar. Use regular Maven tests instead." } }
$editorialDependencies = Join-Path $editorialOutput 'dependencies'
New-Item -ItemType Directory -Path $editorialDependencies -Force | Out-Null
$editorialLocalJars = foreach ($editorialJar in $editorialPaths) {
    $editorialLocal = Join-Path $editorialDependencies ([System.IO.Path]::GetFileName($editorialJar))
    Copy-Item -LiteralPath $editorialJar -Destination $editorialLocal -Force
    $editorialLocal
}
$editorialClasspath = $editorialLocalJars -join [System.IO.Path]::PathSeparator
$editorialSources = @(
    'src/main/java/ua/uzhhorod/digital/editorial/EventDocumentValidator.java',
    'src/main/java/ua/uzhhorod/digital/editorial/EditorialPageController.java',
    'src/main/java/ua/uzhhorod/digital/editorial/SafetyDocumentValidator.java',
    'src/main/java/ua/uzhhorod/digital/editorial/EditorialSafetyMapStore.java',
    'src/main/java/ua/uzhhorod/digital/editorial/EditorialDocument.java',
    'src/main/java/ua/uzhhorod/digital/editorial/EditorialDocumentRepository.java',
    'src/main/java/ua/uzhhorod/digital/editorial/EditorialController.java',
    'src/main/java/ua/uzhhorod/digital/cityservices/maps/api/SafetyMapPointResponse.java',
    'src/main/java/ua/uzhhorod/digital/cityservices/maps/api/SafetyMapPointsResponse.java',
    'src/main/java/ua/uzhhorod/digital/cityservices/maps/application/SafetyMapPointService.java',
    'scripts/SafetyMapCheck.java',
    'scripts/EditorialValidatorCheck.java'
) | ForEach-Object { Join-Path $editorialRoot $_ }
& (Join-Path $editorialJdk 'javac.exe') -encoding UTF-8 -cp $editorialClasspath -d $editorialOutput @editorialSources
if ($LASTEXITCODE -ne 0) { throw 'Editorial compilation failed' }
& (Join-Path $editorialJdk 'java.exe') '-Dstdout.encoding=UTF-8' -cp ($editorialOutput + [System.IO.Path]::PathSeparator + $editorialClasspath) ua.uzhhorod.digital.editorial.EditorialValidatorCheck (Join-Path $editorialRoot 'src/main/resources/editorial/events.json')
if ($LASTEXITCODE -ne 0) { throw 'Editorial checks failed' }
& (Join-Path $editorialJdk 'java.exe') '-Dstdout.encoding=UTF-8' -cp ($editorialOutput + [System.IO.Path]::PathSeparator + $editorialClasspath + [System.IO.Path]::PathSeparator + (Join-Path $editorialRoot 'src/main/resources')) ua.uzhhorod.digital.editorial.SafetyMapCheck
if ($LASTEXITCODE -ne 0) { throw 'Safety map checks failed' }
