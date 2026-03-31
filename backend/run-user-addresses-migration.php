<?php
/**
 * Create user_addresses table without Laravel (works on PHP 7).
 * Usage: php run-user-addresses-migration.php
 */
$envFile = __DIR__ . '/.env';
if (!is_readable($envFile)) {
    fwrite(STDERR, ".env not found\n");
    exit(1);
}
$vars = [];
foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (strpos(trim($line), '#') === 0) continue;
    if (preg_match('/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/', $line, $m)) {
        $vars[$m[1]] = trim($m[2], " \t\"'");
    }
}
$host = $vars['DB_HOST'] ?? '127.0.0.1';
$port = $vars['DB_PORT'] ?? '3306';
$db   = $vars['DB_DATABASE'] ?? '';
$user = $vars['DB_USERNAME'] ?? 'root';
$pass = $vars['DB_PASSWORD'] ?? '';

if (empty($db)) {
    fwrite(STDERR, "DB_DATABASE not set in .env\n");
    exit(1);
}

$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    fwrite(STDERR, "Connection failed: " . $e->getMessage() . "\n");
    exit(1);
}

$sql = "CREATE TABLE IF NOT EXISTS user_addresses (
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
)";
try {
    $pdo->exec($sql);
    echo "user_addresses table created.\n";
} catch (PDOException $e) {
    fwrite(STDERR, "Error: " . $e->getMessage() . "\n");
    exit(1);
}
