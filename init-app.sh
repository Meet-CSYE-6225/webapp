#!/bin/bash
set -e
set -x  # Enable debugging output

# Ensure ARTIFACT_PATH is set by the execute_command
if [ -z "$ARTIFACT_PATH" ]; then
  echo "Artifact not found because ARTIFACT_PATH is not set."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# Update package lists and install prerequisites (ignore non-critical errors)
sudo apt-get update -y || true
sudo apt-get install -y software-properties-common || true

# Enable the universe repository and update package lists again
sudo add-apt-repository universe -y || true
sudo apt-get update -y || true

# Install PostgreSQL packages (ignore non-critical errors)
sudo apt-get install -y postgresql postgresql-contrib || true

# Create group and non-login user 'csye6225'
sudo groupadd -f csye6225
if ! id -u csye6225 >/dev/null 2>&1; then
  sudo useradd -r -g csye6225 -s /usr/sbin/nologin csye6225
fi

# Check that the artifact exists at the provided ARTIFACT_PATH
if [ ! -f "$ARTIFACT_PATH" ]; then
  echo "Artifact not found at $ARTIFACT_PATH"
  exit 1
fi

# If needed, unzip the artifact:
sudo apt-get install -y unzip || true
sudo unzip -o "$ARTIFACT_PATH" -d /opt/csye6225/webapp

# Set ownership of the application directory
sudo chown -R csye6225:csye6225 /opt/csye6225/webapp

# If a systemd service file exists, copy it and enable the service
if [ -f /opt/csye6225/webapp/csye6225.service ]; then
  sudo cp /opt/csye6225/webapp/csye6225.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable csye6225.service
fi
