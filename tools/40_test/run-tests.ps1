# テストを一括で実行する。
#   1. node --test   … inspect.js の表示と、資料の例を Node で動かした結果
#   2. bun test      … 同じテストを Bun でも
#   3. playwright    … 資料の「実行」ボタンをブラウザ（Chromium ・ Firefox）で押した結果と、ページの見た目の崩れ
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$tests = Join-Path $root 'tests'
$failed = @()

Write-Host '=== node --test ==='
$names = @(Get-ChildItem -Path $tests -Filter '*.test.ts' | ForEach-Object { $_.Name })
if ($names.Count -eq 0) { throw 'テストが見つかりません' }
& node --test ($names | ForEach-Object { Join-Path $tests $_ })
if ($LASTEXITCODE -ne 0) { $failed += 'node' }

if (Get-Command bun -ErrorAction SilentlyContinue) {
	Write-Host '=== bun test ==='
	Push-Location $root
	try {
		& bun test ($names | ForEach-Object { './tests/' + $_ })
		if ($LASTEXITCODE -ne 0) { $failed += 'bun' }
	} finally {
		Pop-Location
	}
}

foreach ($browser in 'chromium', 'firefox') {
	Write-Host "=== playwright（$browser） ==="
	Push-Location $root
	try {
		& playwright-test --test-dir (Join-Path $tests 'browser') --out-dir (Join-Path $root "tmp/playwright-$browser") --project=$browser
		if ($LASTEXITCODE -ne 0) { $failed += "playwright（$browser）" }
	} finally {
		Pop-Location
	}
}

if ($failed.Count -eq 0) {
	Write-Host '=== すべて成功しました ==='
} else {
	Write-Host ('=== 失敗: ' + ($failed -join ', ') + ' ===')
}
exit $failed.Count
