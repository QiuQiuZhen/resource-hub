<?php

require __DIR__ . '/api/common.php';

if (current_admin_user() === '') {
    header('Location: ./login.php');
    exit;
}

require __DIR__ . '/admin.html';
