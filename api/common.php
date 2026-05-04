<?php

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();
session_start();

$rootDir = dirname(__DIR__);
$dataDir = $rootDir . DIRECTORY_SEPARATOR . 'data';
$configFile = $rootDir . DIRECTORY_SEPARATOR . 'config.php';
$config = [];

if (is_file($configFile)) {
    $loadedConfig = require $configFile;
    if (is_array($loadedConfig)) {
        $config = $loadedConfig;
    }
}

function send_json($statusCode, $payload)
{
    if (ob_get_length()) {
        ob_clean();
    }

    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_body()
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        send_json(400, ['error' => 'JSON 格式不正确']);
    }

    return $data;
}

function read_json_file($filePath, $fallback)
{
    if (!is_file($filePath)) {
        return $fallback;
    }

    $content = file_get_contents($filePath);
    if ($content === false || trim($content) === '') {
        return $fallback;
    }

    $data = json_decode($content, true);
    return is_array($data) ? $data : $fallback;
}

function write_json_file($dataDir, $filePath, $payload)
{
    if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true)) {
        send_json(500, ['error' => '无法创建 data 目录']);
    }

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        send_json(500, ['error' => '数据编码失败']);
    }

    $tempFile = $filePath . '.tmp';
    $handle = fopen($tempFile, 'wb');
    if (!$handle) {
        send_json(500, ['error' => '无法写入临时数据文件，请检查 data 目录权限']);
    }

    flock($handle, LOCK_EX);
    fwrite($handle, $json . PHP_EOL);
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    if (!rename($tempFile, $filePath)) {
        @unlink($tempFile);
        send_json(500, ['error' => '无法保存数据文件，请检查 data 目录权限']);
    }
}

function current_admin_user()
{
    return isset($_SESSION['resource_hub_admin']) ? (string)$_SESSION['resource_hub_admin'] : '';
}

function require_admin()
{
    if (current_admin_user() !== '') {
        return;
    }

    send_json(401, ['error' => '请先登录后台']);
}

function split_list($value)
{
    if (is_array($value)) {
        $items = array_map(function ($item) {
            return trim((string)$item);
        }, $value);

        return array_values(array_filter($items, function ($item) {
            return $item !== '';
        }));
    }

    $parts = preg_split('/[\r\n,，、;；]+/u', (string)$value);
    if (!is_array($parts)) {
        return [];
    }

    return array_values(array_filter(array_map('trim', $parts), function ($item) {
        return $item !== '';
    }));
}

function normalize_url($value)
{
    $url = trim((string)$value);
    if ($url === '') {
        return '';
    }

    return preg_match('/^https?:\/\//i', $url) ? $url : 'https://' . $url;
}

function normalize_asset_url($value)
{
    $url = trim((string)$value);
    if ($url === '') {
        return '';
    }

    if (preg_match('/^(https?:\/\/|\.\/|\/|uploads\/)/i', $url)) {
        return $url;
    }

    return normalize_url($url);
}

function get_domain($url)
{
    $host = parse_url($url, PHP_URL_HOST);
    if (!is_string($host)) {
        return '';
    }

    return preg_replace('/^www\./i', '', $host) ?? $host;
}
