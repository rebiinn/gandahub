-- Run this SQL if "php artisan migrate" fails (e.g. PHP 7.x).
-- Easiest: from backend folder run:  php run-newsletter-migration.php
-- Or run this file in phpMyAdmin / MySQL Workbench (DB: from .env DB_DATABASE).

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Record so "php artisan migrate" (when you use PHP 8+) won't try to run this again
INSERT IGNORE INTO migrations (migration, batch) VALUES ('2024_03_08_000001_create_newsletter_subscribers_table', 999);
