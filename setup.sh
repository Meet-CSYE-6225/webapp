#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

# Update packages
sudo apt update -y && sudo apt upgrade -y

# Install only the necessary packages (excluding local RDBMS)
sudo apt install -y unzip curl nodejs npm

# Ensure correct working directory
cd /tmp

# App user and group creation
sudo groupadd -f csye6225
id clouduser &>/dev/null || sudo useradd -m -g csye6225 csye6225

# App deployment
sudo mkdir -p /opt/csye6225/webapp && sudo cp -r /tmp/webapp/* /opt/csye6225/webapp/
sudo chown -R csye6225:csye6225 /opt/csye6225 && sudo chmod -R 755 /opt/csye6225

# Environment file (pointing to an external database)
# sudo tee /opt/csye6225/webapp/.env > /dev/null <<EOF
# DB_NAME=health_check_db
# DB_USER=meet
# DB_PASSWORD=Root@123
# DB_HOST=<external_db_host>
# DB_PORT=5432
# PORT=8080
# EOF

# systemd service definition for the web app
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

echo "Setup complete! (Local RDBMS installation has been removed.)"
