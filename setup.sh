#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

# Remove any locks on apt and fix broken dependencies
sudo rm -rf /var/lib/apt/lists/lock
sudo rm -rf /var/lib/dpkg/lock
sudo rm -rf /var/lib/dpkg/lock-frontend
sudo dpkg --configure -a

# Clean up and update package lists
sudo apt-get -y autoremove
sudo apt-get -y autoclean
sudo apt-get -y clean
sudo apt update -y 2>&1 | tee /tmp/apt_update.log
sudo apt upgrade -y -o DPkg::Options::="--force-confdef" -o DPkg::Options::="--force-confold" 2>&1 | tee /tmp/apt_upgrade.log

# Install necessary packages
sudo apt install -y curl unzip gnupg ca-certificates 2>&1 | tee /tmp/apt_install.log

# Add the NodeSource repository for the latest LTS version
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

# Install Node.js (includes npm)
sudo apt-get install -y nodejs

# Ensure correct working directory
cd /tmp

# Create the app user and group if they don't exist
sudo groupadd -f csye6225
id csye6225 &>/dev/null || sudo useradd -m -g csye6225 csye6225

# App deployment: copy application files to the target directory
sudo mkdir -p /opt/csye6225/webapp
sudo cp -r /tmp/webapp/* /opt/csye6225/webapp/
sudo chown -R csye6225:csye6225 /opt/csye6225/webapp
sudo chmod -R 755 /opt/csye6225/webapp

# Create systemd service definition for the web app if it does not already exist
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

# Reload systemd, enable, and start the service
sudo systemctl daemon-reload
sudo systemctl enable csye6225
sudo systemctl start csye6225

echo "Setup complete!"
