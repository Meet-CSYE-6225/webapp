#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

# Update packages
sudo apt update -y && sudo apt upgrade -y

# Install necessary packages
sudo apt install -y curl unzip

# Ensure correct working directory
cd /tmp

# App user and group creation
sudo groupadd -f csye6225
id csye6225 &>/dev/null || sudo useradd -m -g csye6225 csye6225

# Install nvm and Node.js for the csye6225 user
sudo -i -u csye6225 bash << 'EOF'
  # Install nvm
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

  # Load nvm
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  # Install the latest Node.js version
  nvm install node

  # Set default Node.js version
  nvm alias default node
EOF

# Create symbolic links to make node and npm accessible system-wide
sudo ln -sf /home/csye6225/.nvm/versions/node/$(sudo -i -u csye6225 bash -c 'nvm current')/bin/node /usr/bin/node
sudo ln -sf /home/csye6225/.nvm/versions/node/$(sudo -i -u csye6225 bash -c 'nvm current')/bin/npm /usr/bin/npm

# App deployment
sudo mkdir -p /opt/csye6225/webapp && sudo cp -r /tmp/webapp/* /opt/csye6225/webapp/
sudo chown -R csye6225:csye6225 /opt/csye6225 && sudo chmod -R 755 /opt/csye6225

# Create logs directory with proper permissions
sudo mkdir -p /opt/csye6225/webapp/logs
sudo chown csye6225:csye6225 /opt/csye6225/webapp/logs
sudo chmod 755 /opt/csye6225/webapp/logs

# Create the log file and set proper permissions
sudo touch /opt/csye6225/webapp/logs/app.log
sudo chown csye6225:csye6225 /opt/csye6225/webapp/logs/app.log
sudo chmod 644 /opt/csye6225/webapp/logs/app.log

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

echo "Setup complete!"
