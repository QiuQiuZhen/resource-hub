<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    send_json(405, ['error' => '不支持的请求方法']);
}

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    send_json(400, ['error' => '没有收到上传文件']);
}

$file = $_FILES['file'];

if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    send_json(400, ['error' => '文件上传失败']);
}

if (($file['size'] ?? 0) > 2 * 1024 * 1024) {
    send_json(400, ['error' => '图标不能超过 2MB']);
}

$tmpName = (string)($file['tmp_name'] ?? '');
if ($tmpName === '' || !is_uploaded_file($tmpName)) {
    send_json(400, ['error' => '上传临时文件无效']);
}

$imageInfo = @getimagesize($tmpName);
if (!$imageInfo || !isset($imageInfo['mime'])) {
    send_json(400, ['error' => '请上传图片文件']);
}

$allowed = [
    'image/png' => 'png',
    'image/jpeg' => 'jpg',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
];

$mime = $imageInfo['mime'];
if (!isset($allowed[$mime])) {
    send_json(400, ['error' => '仅支持 png、jpg、webp、gif 图标']);
}

$uploadDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'icons';
if (!is_dir($uploadDir) && !@mkdir($uploadDir, 0755, true)) {
    send_json(500, ['error' => '无法创建上传目录']);
}

if (!is_writable($uploadDir)) {
    send_json(500, ['error' => 'uploads/icons 目录不可写，请在宝塔文件权限里设置可写']);
}

$filename = 'icon-' . date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '.' . $allowed[$mime];
$targetPath = $uploadDir . DIRECTORY_SEPARATOR . $filename;

if (!@move_uploaded_file($tmpName, $targetPath)) {
    send_json(500, ['error' => '保存上传文件失败，请检查 uploads 目录权限']);
}

send_json(200, [
    'url' => './uploads/icons/' . $filename,
    'filename' => $filename,
]);
