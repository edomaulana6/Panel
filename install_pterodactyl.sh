#!/bin/bash

# Pterodactyl Panel Installation Script
#
# This script automates the installation of the Pterodactyl Panel on a
# fresh Ubuntu server. It is based on the official documentation and
# includes all necessary dependencies and configurations discovered during
# a manual installation process.
#
# WARNING: Run this script as a user with sudo privileges on a clean server.
# It is not idempotent and running it on a server with existing configurations
# may cause issues.

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Helper Functions for Output ---
print_info() {
    echo -e "\e[34m[INFO]\e[0m $1"
}

print_success() {
    echo -e "\e[32m[SUCCESS]\e[0m $1"
}

print_warning() {
    echo -e "\e[33m[WARNING]\e[0m $1"
}

# --- Step 1: System Dependencies ---
print_info "Updating package lists and installing system dependencies..."
sudo apt-get update
sudo apt-get install -y software-properties-common curl apt-transport-https ca-certificates gnupg cron

print_info "Adding third-party repositories for PHP and Redis..."
sudo LC_ALL=C.UTF-8 add-apt-repository -y ppa:ondrej/php
sudo curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list

print_info "Updating package lists again..."
sudo apt-get update

print_info "Installing main packages (PHP, MariaDB, Nginx, etc.)..."
sudo apt-get install -y php8.3 php8.3-{common,cli,gd,mysql,mbstring,bcmath,xml,fpm,curl,zip} mariadb-server nginx tar unzip git redis-server

# --- Step 2: Fix Default Nginx Conf and Start Services ---
print_info "Fixing default Nginx configuration to prevent IPv6 startup errors..."
sudo sed -i 's/listen \[::\]:80 default_server;/#listen [::]:80 default_server;/' /etc/nginx/sites-available/default

print_info "Starting essential services (Nginx, MariaDB, Redis, cron)..."
sudo systemctl start nginx
sudo systemctl start mariadb
sudo systemctl start redis-server
sudo systemctl start cron

# --- Step 3: Install Composer ---
print_info "Installing Composer globally..."
curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer

# --- Step 4: Download & Prepare Pterodactyl Files ---
print_info "Downloading and preparing Pterodactyl panel files..."
sudo mkdir -p /var/www/pterodactyl
cd /var/www/pterodactyl
sudo curl -Lo panel.tar.gz https://github.com/pterodactyl/panel/releases/latest/download/panel.tar.gz
sudo tar -xzvf panel.tar.gz
sudo chmod -R 755 storage/* bootstrap/cache/

# --- Step 5: Database Setup ---
print_info "Setting up MariaDB database and user..."
DB_PASSWORD=$(head /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 16)
sudo mariadb <<EOF
CREATE USER 'pterodactyl'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
CREATE DATABASE panel;
GRANT ALL PRIVILEGES ON panel.* TO 'pterodactyl'@'127.0.0.1' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EOF
print_success "Database 'panel' and user 'pterodactyl' created."
print_warning "Database Password: ${DB_PASSWORD}"

# --- Step 6: Application Configuration ---
print_info "Configuring Pterodactyl application..."
sudo cp .env.example .env
sudo COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader
sudo php artisan key:generate --force
sudo php artisan p:environment:setup --cache=redis --session=redis --queue=redis --no-interaction
sudo php artisan p:environment:database --host=127.0.0.1 --port=3306 --database=panel --username=pterodactyl --password="${DB_PASSWORD}" --no-interaction
sudo php artisan p:environment:mail --driver=mail --no-interaction

# --- Step 7: Database Migration & Seeding ---
print_info "Running database migrations and seeding..."
sudo php artisan migrate --seed --force

# --- Step 8: Create Administrator User ---
print_info "Creating administrator user..."
ADMIN_PASSWORD=$(head /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 16)
sudo php artisan p:user:make --admin=1 --email=admin@example.com --username=admin --name-first=Admin --name-last=User --password="${ADMIN_PASSWORD}" --no-interaction

# --- Step 9: Set File Permissions ---
print_info "Setting file permissions for Pterodactyl..."
sudo chown -R www-data:www-data /var/www/pterodactyl

# --- Step 10: Configure Queue Worker ---
print_info "Configuring queue worker (cron and systemd)..."
echo "* * * * * php /var/www/pterodactyl/artisan schedule:run >> /dev/null 2>&1" | sudo crontab -
sudo tee /etc/systemd/system/pteroq.service > /dev/null <<EOF
[Unit]
Description=Pterodactyl Queue Worker
After=redis-server.service

[Service]
User=www-data
Group=www-data
Restart=always
ExecStart=/usr/bin/php /var/www/pterodactyl/artisan queue:work --queue=high,standard,low --sleep=3 --tries=3
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now redis-server
sudo systemctl enable --now pteroq.service

# --- Step 11: Configure Nginx ---
print_info "Configuring Nginx to serve the panel..."
sudo rm -f /etc/nginx/sites-enabled/default
sudo tee /etc/nginx/sites-available/pterodactyl.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name localhost;

    root /var/www/pterodactyl/public;
    index index.html index.htm index.php;
    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    access_log off;
    error_log  /var/log/nginx/pterodactyl.app-error.log error;

    client_max_body_size 100m;
    client_body_timeout 120s;

    sendfile off;

    location ~ \.php$ {
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param PHP_VALUE "upload_max_filesize = 100M \n post_max_size=100M";
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param HTTP_PROXY "";
        fastcgi_intercept_errors off;
        fastcgi_buffer_size 16k;
        fastcgi_buffers 4 16k;
        fastcgi_connect_timeout 300;
        fastcgi_send_timeout 300;
        fastcgi_read_timeout 300;
    }

    location ~ /\.ht {
        deny all;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/pterodactyl.conf /etc/nginx/sites-enabled/pterodactyl.conf
sudo nginx -t
sudo systemctl restart nginx

# --- Step 12: Final Service Start ---
print_info "Starting PHP-FPM service..."
sudo systemctl enable --now php8.3-fpm

print_success "Pterodactyl Panel installation script has finished!"
echo "=================================================="
print_info "You should be able to access the panel at your server's IP address."
print_info "Admin Username: admin"
print_warning "Admin Password: ${ADMIN_PASSWORD}"
echo "=================================================="
