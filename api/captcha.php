<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

$chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
$code = '';
for ($index = 0; $index < 4; $index++) {
    $code .= $chars[random_int(0, strlen($chars) - 1)];
}

$_SESSION['resource_hub_captcha'] = strtolower($code);

header('Content-Type: image/svg+xml; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$escapedCode = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
$noiseA = random_int(12, 42);
$noiseB = random_int(56, 88);

echo <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="44" viewBox="0 0 128 44">
  <rect width="128" height="44" rx="8" fill="#eef2ed"/>
  <path d="M8 {$noiseA} C32 4, 78 48, 120 {$noiseB}" fill="none" stroke="#1f7a5a" stroke-width="2" opacity=".32"/>
  <path d="M8 {$noiseB} C42 48, 72 0, 120 {$noiseA}" fill="none" stroke="#d95c45" stroke-width="2" opacity=".24"/>
  <text x="64" y="29" text-anchor="middle" font-family="Consolas, monospace" font-size="22" font-weight="800" fill="#20231f" letter-spacing="4">{$escapedCode}</text>
</svg>
SVG;
