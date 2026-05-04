<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function password_matches($password, $config)
{
    $hash = (string)($config['admin_password_hash'] ?? '');
    if ($hash !== '') {
        return password_verify($password, $hash);
    }

    return hash_equals((string)($config['admin_password'] ?? ''), $password);
}

if ($method === 'GET') {
    send_json(200, [
        'loggedIn' => current_admin_user() !== '',
        'username' => current_admin_user(),
    ]);
}

$body = read_json_body();
$action = (string)($body['action'] ?? 'login');

if ($method === 'POST' && $action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    send_json(200, ['ok' => true]);
}

if ($method !== 'POST') {
    send_json(405, ['error' => '不支持的请求方法']);
}

$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');
$captcha = strtolower(trim((string)($body['captcha'] ?? '')));
$expectedCaptcha = (string)($_SESSION['resource_hub_captcha'] ?? '');
$expectedUsername = (string)($config['admin_username'] ?? 'admin');

if ($expectedCaptcha === '' || !hash_equals($expectedCaptcha, $captcha)) {
    send_json(400, ['error' => '验证码不正确']);
}

if ($username === $expectedUsername && password_matches($password, $config)) {
    session_regenerate_id(true);
    $_SESSION['resource_hub_admin'] = $username;
    unset($_SESSION['resource_hub_captcha']);
    send_json(200, [
        'ok' => true,
        'username' => $username,
    ]);
}

send_json(401, ['error' => '账号或密码不正确']);
