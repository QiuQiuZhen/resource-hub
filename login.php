<?php

require __DIR__ . '/api/common.php';

if (current_admin_user() !== '') {
    header('Location: ./admin.php');
    exit;
}

require __DIR__ . '/login.html';
