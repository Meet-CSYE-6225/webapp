#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

# Update packages
sudo apt update -y && sudo apt upgrade -y

# Install curl and unzip if not installed
sudo apt install -y curl unzip

# Install Node.js from NodeSource (latest LTS or current version)
# For the latest current version:
curl -fsSL https://deb.nodesource.com/setup_current.x | sudo -E bash -
# Or for the latest LTS version, use:
# curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

sudo apt install -y nodejs

# Verify installation
node -v
npm -v

# Ensure correct working directory
cd /tmp

# App user and group creation
sudo groupadd -f csye6225
id clouduser &>/dev/null || sudo useradd -m -g csye6225 csye6225

# App deployment
sudo mkdir -p /opt/csye6225/webapp && sudo cp -r /tmp/webapp/* /opt/csye6225/webapp/
sudo chown -R csye6225:csye6225 /opt/csye6225 && sudo chmod -R 755 /opt/csye6225

# (Optional) Create your .env file here if needed

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
