#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

# Update packages
sudo apt update -y && sudo apt upgrade -y

# Install necessary packages
sudo apt install -y curl unzip curl nodejs npm

# Ensure correct working directory
cd /tmp

# App user and group creation
sudo groupadd -f csye6225
id csye6225 &>/dev/null || sudo useradd -m -g csye6225 csye6225

# Update package lists and install prerequisites
sudo apt update && sudo apt install -y curl gnupg ca-certificates

# Add the NodeSource repository for the latest LTS version
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

# Install Node.js (includes npm)
sudo apt-get install -y nodejs

# App deployment: copy application files to the target directory
sudo mkdir -p /opt/csye6225/webapp && sudo cp -r /tmp/webapp/* /opt/csye6225/webapp/
sudo chown -R csye6225:csye6225 /opt/csye6225/webapp && sudo chmod -R 755 /opt/csye6225/webapp

# Environment file (pointing to an external database)
# sudo tee /opt/csye6225/webapp/.env > /dev/null <<EOF
# DB_NAME=health_check_db
# DB_USER=meet
# DB_PASSWORD=Root@123
# DB_HOST=<external_db_host>
# DB_PORT=5432
# PORT=8080
# EOF

# (Note: No local logs directory or log file is created now.)

# Create systemd service definition for the web app (if not already created)
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
StandardOutput=syslog
StandardError=syslog

[Install]
WantedBy=multi-user.target
EOF
fi

sudo systemctl daemon-reload
sudo systemctl enable csye6225
sudo systemctl start csye6225

echo "Setup complete!"
