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
  # Install nvm if not already installed
  if [ ! -d "$HOME/.nvm" ]; then
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
  fi
  # Load nvm
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  # Install the latest Node.js version (if not already installed)
  nvm install node || true
  # Set default Node.js version
  nvm alias default node
EOF

# Create symbolic links to make node and npm accessible system-wide
NODE_PATH=$(find /home/csye6225/.nvm/versions/node/ -maxdepth 1 -type d | sort | tail -n 1)
sudo ln -sf "$NODE_PATH/bin/node" /usr/bin/node
sudo ln -sf "$NODE_PATH/bin/npm" /usr/bin/npm

# App deployment: copy application files to the target directory
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

[Install]
WantedBy=multi-user.target
EOF
fi

sudo systemctl daemon-reload
sudo systemctl enable csye6225
sudo systemctl start csye6225

echo "Setup complete!"
