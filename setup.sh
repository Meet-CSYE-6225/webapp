#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

# Update packages
sudo apt update -y && sudo apt upgrade -y

# Add PostgreSQL repository securely
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | sudo tee /usr/share/keyrings/postgresql.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update && sudo apt install -y postgresql-14 postgresql-contrib-14 unzip curl nodejs npm

# Ensure correct working directory
cd /tmp

# PostgreSQL setup
sudo systemctl start postgresql && sudo systemctl enable postgresql
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/14/main/postgresql.conf
echo "host    all    all    0.0.0.0/0    md5" | sudo tee -a /etc/postgresql/14/main/pg_hba.conf

sudo chown -R postgres:postgres /var/lib/postgresql
sudo systemctl restart postgresql

# Database setup
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='health_check_db'")
[ "$DB_EXISTS" != "1" ] && sudo -u postgres psql -c "CREATE DATABASE health_check_db;"

USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='meet'")
[ "$USER_EXISTS" != "1" ] && sudo -u postgres psql -c "CREATE USER meet WITH PASSWORD 'Root@123';"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE health_check_db TO meet;"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'Root@123';"

# App user and group
sudo groupadd -f csye6225
id clouduser &>/dev/null || sudo useradd -m -g csye6225 csye6225

# App deployment
sudo mkdir -p /opt/csye6225/webapp && sudo cp -r /tmp/webapp/* /opt/csye6225/webapp/
sudo chown -R csye6225:csye6225 /opt/csye6225 && sudo chmod -R 755 /opt/csye6225

# Environment file
sudo tee /opt/csye6225/webapp/.env > /dev/null <<EOF
DB_NAME=health_check_db
DB_USER=meet
DB_PASS=Root@123
DB_HOST=localhost
PORT=8080
EOF

# systemd service
if [ ! -f "/etc/systemd/system/csye6225.service" ]; then 
sudo tee /etc/systemd/system/csye6225.service > /dev/null <<EOF
[Unit]
Description=CSYE6225 Web Application Service
After=network.target

[Service]
Type=simple
User=csye6225
WorkingDirectory=/opt/csye6225/webapp
ExecStart=/usr/bin/node app.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
fi

sudo systemctl daemon-reload
sudo systemctl enable csye6225
sudo systemctl start csye6225

echo " Setup complete! "