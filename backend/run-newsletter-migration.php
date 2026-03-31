<?php
/**
 * Run newsletter migration without Laravel (works on PHP 7).
 * Usage: php run-newsletter-migration.php
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

$sqlFile = __DIR__ . '/database/migrations/2024_03_08_000001_create_newsletter_subscribers_table.sql';
$sql = file_get_contents($sqlFile);
// Remove comments and empty lines, split by semicolon
$statements = array_filter(
    array_map('trim', explode(';', preg_replace('/--[^\n]*\n/', "\n", $sql))),
    function ($s) { return $s !== ''; }
);

foreach ($statements as $stmt) {
    try {
        $pdo->exec($stmt);
        echo "OK: " . substr(str_replace("\n", ' ', $stmt), 0, 60) . "...\n";
    } catch (PDOException $e) {
        fwrite(STDERR, "Error: " . $e->getMessage() . "\n");
        exit(1);
    }
}

echo "Newsletter migration done. Table newsletter_subscribers is ready.\n";
