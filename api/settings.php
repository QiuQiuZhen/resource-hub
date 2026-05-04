<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

$settingsFile = $dataDir . DIRECTORY_SEPARATOR . 'settings.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function default_settings()
{
    return [
        'siteName' => '集盒',
        'siteSubtitle' => 'Resource Hub',
        'logoText' => '集',
        'logoUrl' => '',
        'faviconUrl' => '',
        'footerText' => '© 2026 集盒 Resource Hub',
        'icpText' => '',
        'icpUrl' => '',
        'resourceTypes' => [
            [
                'id' => 'ai',
                'label' => 'AI 工具',
            ],
            [
                'id' => 'computer',
                'label' => '电脑工具',
            ],
        ],
        'groupsEnabled' => true,
        'groups' => [
            [
                'id' => 'starter',
                'title' => '新手入门',
                'description' => '刚关注先看这组',
            ],
            [
                'id' => 'creator',
                'title' => '内容创作',
                'description' => '写作、图片、视频',
            ],
            [
                'id' => 'office',
                'title' => '办公装机',
                'description' => '截图、PDF、效率',
            ],
        ],
        'slides' => [
            [
                'title' => 'AI 工具合集 + 电脑必装工具集',
                'subtitle' => '给公众号自动回复准备的资源导航页',
                'description' => '把常用工具按场景整理好，用户从公众号点进来就能搜索、筛选、直达官网。',
                'image' => 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80',
            ],
        ],
        'preferences' => [
            [
                'id' => 'free',
                'label' => '优先免费 / 免费可用',
                'field' => 'price',
                'keywords' => ['免费', '开源'],
            ],
            [
                'id' => 'domestic',
                'label' => '国内访问更友好',
                'field' => 'all',
                'keywords' => ['国内访问友好', 'domestic'],
            ],
        ],
    ];
}

function normalize_id($value, $fallback)
{
    $id = strtolower(trim((string)$value));
    $id = preg_replace('/[^a-z0-9_-]+/', '-', $id);
    $id = trim((string)$id, '-');
    return $id !== '' ? $id : $fallback;
}

function normalize_settings($input)
{
    $defaults = default_settings();
    $slides = [];
    $preferences = [];
    $resourceTypes = [];
    $groups = [];

    foreach (($input['resourceTypes'] ?? []) as $index => $type) {
        if (!is_array($type)) {
            continue;
        }

        $label = trim((string)($type['label'] ?? ''));
        if ($label === '') {
            continue;
        }

        $resourceTypes[] = [
            'id' => normalize_id($type['id'] ?? '', 'type-' . ($index + 1)),
            'label' => $label,
        ];
    }

    foreach (($input['groups'] ?? []) as $index => $group) {
        if (!is_array($group)) {
            continue;
        }

        $title = trim((string)($group['title'] ?? ''));
        if ($title === '') {
            continue;
        }

        $groups[] = [
            'id' => normalize_id($group['id'] ?? '', 'group-' . ($index + 1)),
            'title' => $title,
            'description' => trim((string)($group['description'] ?? '')),
        ];
    }

    foreach (($input['slides'] ?? []) as $index => $slide) {
        if (!is_array($slide)) {
            continue;
        }

        $image = normalize_asset_url($slide['image'] ?? '');
        $title = trim((string)($slide['title'] ?? ''));

        if ($image === '' && $title === '') {
            continue;
        }

        $slides[] = [
            'title' => $title,
            'subtitle' => trim((string)($slide['subtitle'] ?? '')),
            'description' => trim((string)($slide['description'] ?? '')),
            'image' => $image,
        ];
    }

    foreach (($input['preferences'] ?? []) as $index => $preference) {
        if (!is_array($preference)) {
            continue;
        }

        $label = trim((string)($preference['label'] ?? ''));
        $keywords = split_list($preference['keywords'] ?? []);

        if ($label === '' || count($keywords) === 0) {
            continue;
        }

        $field = (string)($preference['field'] ?? 'all');
        if (!in_array($field, ['all', 'price', 'access', 'tags', 'category', 'platforms'], true)) {
            $field = 'all';
        }

        $preferences[] = [
            'id' => normalize_id($preference['id'] ?? '', 'pref-' . ($index + 1)),
            'label' => $label,
            'field' => $field,
            'keywords' => $keywords,
        ];
    }

    if (count($slides) === 0) {
        $slides = $defaults['slides'];
    }

    if (count($resourceTypes) === 0) {
        $resourceTypes = $defaults['resourceTypes'];
    }

    return [
        'siteName' => trim((string)($input['siteName'] ?? $defaults['siteName'])) ?: $defaults['siteName'],
        'siteSubtitle' => trim((string)($input['siteSubtitle'] ?? $defaults['siteSubtitle'])),
        'logoText' => trim((string)($input['logoText'] ?? $defaults['logoText'])),
        'logoUrl' => normalize_asset_url($input['logoUrl'] ?? ''),
        'faviconUrl' => normalize_asset_url($input['faviconUrl'] ?? ''),
        'footerText' => trim((string)($input['footerText'] ?? $defaults['footerText'])),
        'icpText' => trim((string)($input['icpText'] ?? '')),
        'icpUrl' => normalize_url($input['icpUrl'] ?? ''),
        'resourceTypes' => $resourceTypes,
        'groupsEnabled' => (bool)($input['groupsEnabled'] ?? true),
        'groups' => $groups,
        'slides' => $slides,
        'preferences' => $preferences,
    ];
}

if ($method === 'GET') {
    send_json(200, read_json_file($settingsFile, default_settings()));
}

require_admin();

if ($method === 'PUT' || $method === 'POST') {
    $settings = normalize_settings(read_json_body());
    write_json_file($dataDir, $settingsFile, $settings);
    send_json(200, $settings);
}

send_json(405, ['error' => '不支持的请求方法']);
