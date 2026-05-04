<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'tools.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = trim((string)($_GET['id'] ?? ''));

function slugify($value)
{
    $text = strtolower(trim((string)$value));
    $slug = preg_replace('/[^a-z0-9_-]+/', '-', $text);
    $slug = trim((string)$slug, '-');

    if ($slug !== '') {
        return $slug;
    }

    return 'tool-' . bin2hex(random_bytes(4));
}

function unique_id($name, $tools, $currentId = '')
{
    if ($currentId !== '') {
        return $currentId;
    }

    $baseId = slugify($name);
    $ids = array_flip(array_filter(array_column($tools, 'id')));
    $nextId = $baseId;
    $index = 2;

    while (isset($ids[$nextId])) {
        $nextId = $baseId . '-' . $index;
        $index++;
    }

    return $nextId;
}

function normalize_buttons($input)
{
    $buttons = [];

    if (isset($input['buttons']) && is_array($input['buttons'])) {
        foreach ($input['buttons'] as $button) {
            if (!is_array($button)) {
                continue;
            }

            $label = trim((string)($button['label'] ?? ''));
            $url = normalize_url($button['url'] ?? '');

            if ($label === '' && $url === '') {
                continue;
            }

            $buttons[] = [
                'label' => $label !== '' ? $label : '打开链接',
                'url' => $url,
            ];
        }
    }

    if (count($buttons) === 0) {
        $legacyUrl = normalize_url($input['url'] ?? '');
        $legacyLabel = trim((string)($input['buttonLabel'] ?? ''));

        if ($legacyUrl !== '') {
            $buttons[] = [
                'label' => $legacyLabel !== '' ? $legacyLabel : '打开官网',
                'url' => $legacyUrl,
            ];
        }
    }

    return $buttons;
}

function normalize_tool($input, $tools, $currentId = '')
{
    $buttons = normalize_buttons($input);
    $primaryUrl = count($buttons) > 0 ? $buttons[0]['url'] : normalize_url($input['url'] ?? '');
    $primaryLabel = count($buttons) > 0 ? $buttons[0]['label'] : trim((string)($input['buttonLabel'] ?? '打开官网'));
    $domain = trim((string)($input['domain'] ?? ''));

    return [
        'id' => unique_id((string)($input['name'] ?? $input['id'] ?? 'tool'), $tools, $currentId ?: (string)($input['id'] ?? '')),
        'name' => trim((string)($input['name'] ?? '')),
        'type' => slugify($input['type'] ?? 'ai'),
        'category' => trim((string)($input['category'] ?? '未分类')),
        'description' => trim((string)($input['description'] ?? '')),
        'longDescription' => trim((string)($input['longDescription'] ?? '')),
        'bestFor' => trim((string)($input['bestFor'] ?? '')),
        'price' => trim((string)($input['price'] ?? '')),
        'platforms' => split_list($input['platforms'] ?? []),
        'access' => trim((string)($input['access'] ?? '国内访问需确认')),
        'url' => $primaryUrl,
        'domain' => $domain !== '' ? $domain : get_domain($primaryUrl),
        'iconUrl' => normalize_asset_url($input['iconUrl'] ?? ''),
        'buttonLabel' => $primaryLabel !== '' ? $primaryLabel : '打开官网',
        'buttons' => $buttons,
        'groupIds' => split_list($input['groupIds'] ?? []),
        'tags' => split_list($input['tags'] ?? []),
        'featured' => (bool)($input['featured'] ?? false),
    ];
}

function validate_tool($tool)
{
    $errors = [];

    if ($tool['name'] === '') {
        $errors[] = '工具名称不能为空';
    }

    if ($tool['category'] === '') {
        $errors[] = '分类不能为空';
    }

    if (!isset($tool['buttons']) || count($tool['buttons']) === 0) {
        $errors[] = '至少需要添加一个按钮';
    }

    foreach (($tool['buttons'] ?? []) as $index => $button) {
        if (($button['label'] ?? '') === '') {
            $errors[] = '第 ' . ($index + 1) . ' 个按钮文案不能为空';
        }

        $url = (string)($button['url'] ?? '');
        if ($url === '') {
            $errors[] = '第 ' . ($index + 1) . ' 个按钮链接不能为空';
            continue;
        }

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            $errors[] = '第 ' . ($index + 1) . ' 个按钮链接格式不正确';
            continue;
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);
        if (!in_array($scheme, ['http', 'https'], true)) {
            $errors[] = '第 ' . ($index + 1) . ' 个按钮链接必须是 http 或 https 地址';
        }
    }

    return $errors;
}

$tools = read_json_file($dataFile, []);

if ($method === 'GET') {
    $normalized = array_map(function ($tool) {
        return is_array($tool) ? normalize_tool($tool, [], (string)($tool['id'] ?? '')) : $tool;
    }, $tools);

    send_json(200, $normalized);
}

require_admin();

if ($method === 'POST') {
    $tool = normalize_tool(read_json_body(), $tools);
    $errors = validate_tool($tool);

    if ($errors) {
        send_json(400, ['errors' => $errors]);
    }

    array_unshift($tools, $tool);
    write_json_file($dataDir, $dataFile, $tools);
    send_json(201, $tool);
}

if ($id === '') {
    send_json(400, ['error' => '缺少工具 ID']);
}

$index = null;
foreach ($tools as $toolIndex => $tool) {
    if (($tool['id'] ?? '') === $id) {
        $index = $toolIndex;
        break;
    }
}

if ($index === null) {
    send_json(404, ['error' => '没有找到这个工具']);
}

if ($method === 'PUT') {
    $tool = normalize_tool(read_json_body(), $tools, $id);
    $errors = validate_tool($tool);

    if ($errors) {
        send_json(400, ['errors' => $errors]);
    }

    $tools[$index] = $tool;
    write_json_file($dataDir, $dataFile, $tools);
    send_json(200, $tool);
}

if ($method === 'DELETE') {
    array_splice($tools, $index, 1);
    write_json_file($dataDir, $dataFile, $tools);
    send_json(200, ['ok' => true]);
}

send_json(405, ['error' => '不支持的请求方法']);
