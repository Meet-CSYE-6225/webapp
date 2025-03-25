#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

# Update packages
sudo apt update -y && sudo apt upgrade -y

# Install necessary packages (node, npm, unzip, curl)
sudo apt install -y unzip curl nodejs npm

# Install CloudWatch Agent (Ubuntu package)
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# Ensure correct working directory
cd /tmp

# App user and group creation
sudo groupadd -f csye6225
id clouduser &>/dev/null || sudo useradd -m -g csye6225 csye6225

# App deployment
sudo mkdir -p /opt/csye6225/webapp && sudo cp -r /tmp/webapp/* /opt/csye6225/webapp/
sudo chown -R csye6225:csye6225 /opt/csye6225 && sudo chmod -R 755 /opt/csye6225

# (Optional) Uncomment and update your external database settings in .env if needed
# sudo tee /opt/csye6225/webapp/.env > /dev/null <<EOF
# DB_NAME=health_check_db
# DB_USER=meet
# DB_PASSWORD=your_password
# DB_HOST=<external_db_host>
# DB_PORT=5432
# PORT=8080
# EMAIL_HOST=smtp.yourdomain.com
# EMAIL_PORT=587
# EMAIL_SECURE=false
# EMAIL_USER=your_email_user
# EMAIL_PASS=your_email_password
# EMAIL_FROM=you@yourdomain.com
# TEST_EMAIL_TO=recipient@domain.com
# STATSD_HOST=localhost
# STATSD_PORT=8125
# EOF

# Copy CloudWatch agent configuration
sudo cp /tmp/webapp/cloud-watch-agent-config.json /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Restart CloudWatch Agent
sudo amazon-cloudwatch-agent-ctl -a stop
sudo amazon-cloudwatch-agent-ctl -a start -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -m ec2

# Systemd service definition for the web app (if not already present)
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
