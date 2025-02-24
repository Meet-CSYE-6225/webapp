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

# Install unzip (to extract the artifact)
sudo apt-get install -y unzip || true

# Create group and non-login user 'csye6225'
sudo groupadd -f csye6225
if ! id -u csye6225 >/dev/null 2>&1; then
  sudo useradd -r -g csye6225 -s /usr/sbin/nologin csye6225
fi

# Verify the artifact exists
if [ ! -f "$ARTIFACT_PATH" ]; then
  echo "Artifact not found at $ARTIFACT_PATH"
  exit 1
fi

# List the artifact to confirm it is present
ls -l "$ARTIFACT_PATH"

# Create the destination directory if it does not exist
sudo mkdir -p /opt/csye6225/webapp

# Unzip the artifact into the destination directory
sudo unzip -o "$ARTIFACT_PATH" -d /opt/csye6225/webapp

# List the contents of the webapp directory to verify files were extracted
ls -la /opt/csye6225/webapp

# Set ownership of the application directory
sudo chown -R csye6225:csye6225 /opt/csye6225/webapp

# If a systemd service file exists in the unzipped content, copy it and enable the service
if [ -f /opt/csye6225/webapp/csye6225.service ]; then
  sudo cp /opt/csye6225/webapp/csye6225.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable csye6225.service
fi
