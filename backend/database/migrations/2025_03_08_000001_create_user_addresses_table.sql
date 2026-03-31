-- Run if php artisan migrate fails. From backend: php -r "require 'vendor/autoload.php'; ..." or run in MySQL client.
-- Database: from .env DB_DATABASE

CREATE TABLE IF NOT EXISTS user_addresses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(50) DEFAULT 'home',
    address VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(255) NULL,
    zip_code VARCHAR(20) NOT NULL,
    country VARCHAR(255) DEFAULT 'Philippines',
    lat DECIMAL(10,8) NULL,
    lng DECIMAL(11,8) NULL,
    is_default TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    INDEX idx_user_default (user_id, is_default),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
