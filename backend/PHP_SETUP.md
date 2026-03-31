# PHP 8.1+ required for this backend

Composer declares `"php": "^8.1"`, so **PHP 8.1, 8.2, 8.3, 8.4, 8.5**, etc. are all acceptable as long as they satisfy that constraint. Use the newest stable PHP you can for security and performance.

The error you see:

```
Composer detected issues in your platform: Your Composer dependencies require a PHP version ">= 8.1.0". You are running 7.4.15.
```

means the backend **requires PHP 8.1 or newer**. Laravel 10 and its dependencies cannot run on PHP 7.4.

## Install PHP 8.1+ on Windows

### Option 1: php.net (manual)

1. Go to [https://windows.php.net/download/](https://windows.php.net/download/).
2. Download a **VS16 x64 Non Thread Safe** (or Thread Safe) build for **PHP 8.1** or **8.2** (e.g. `php-8.1.x-Win32-vs16-x64.zip`).
3. Extract to a folder, e.g. `C:\php81`.
4. Add that folder to your **PATH**:
   - Search “Environment variables” in Windows → Edit “Path” → Add `C:\php81`.
5. Open a **new** terminal and run:
   ```bash
   php -v
   ```
   You should see something like `PHP 8.1.x` or `PHP 8.2.x`.

### Option 2: XAMPP with PHP 8.1

1. Install [XAMPP](https://www.apachefriends.org/) with PHP 8.1 (or 8.2) from their downloads.
2. Add the XAMPP PHP folder to your PATH (e.g. `C:\xampp\php`), or run commands using the full path:
   ```bash
   C:\xampp\php\php.exe artisan serve
   ```

### Option 3: Laravel Herd (Windows)

[Laravel Herd](https://herd.laravel.com/windows) installs PHP and makes it easy to switch versions.

---

After PHP 8.1+ is in your PATH, in the backend folder run:

```bash
cd c:\websystproj\backend
php artisan serve
```

You should see: `Server running on [http://127.0.0.1:8000]`.

## Optional: Windows helper script

If you keep PHP in a fixed folder (e.g. PHP 8.5) and do not want to change your global PATH, you can copy and edit **`serve-php85.bat`** in this folder: set `PHP85` to your `php.exe` path, then run the batch file from `backend/` to start `php artisan serve`.
