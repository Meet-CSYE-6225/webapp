#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

# Change to a directory with proper permissions
cd /tmp

# Clean apt lists to fix GPG splitting errors
sudo rm -rf /var/lib/apt/lists/*

# Update and upgrade packages in non-interactive mode
sudo apt-get update -y < /dev/null
sudo apt-get upgrade -y < /dev/null

# Add PostgreSQL APT repository and import its key
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
  gpg --dearmor | sudo tee /usr/share/keyrings/postgresql.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
  sudo tee /etc/apt/sources.list.d/pgdg.list

# Update package list again and install PostgreSQL and other dependencies
sudo apt-get update -y < /dev/null
sudo apt-get install -y postgresql-14 postgresql-contrib-14 unzip curl nodejs npm < /dev/null

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql || true

# Update PostgreSQL configuration for remote connections
sudo sed -i "s/^#\?listen_addresses\s*=.*/listen_addresses = '*'/" /etc/postgresql/14/main/postgresql.conf

# Append rule to pg_hba.conf if not already present
sudo grep -q "^host\s\+all\s\+all\s\+0.0.0.0/0\s\+md5" /etc/postgresql/14/main/pg_hba.conf || \
    echo "host    all    all    0.0.0.0/0    md5" | sudo tee -a /etc/postgresql/14/main/pg_hba.conf

# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql

# Create database 'health_check_db' if it doesn't exist
DB_EXISTS=$(sudo -H -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='health_check_db'")
if [ "$DB_EXISTS" != "1" ]; then
    sudo -H -u postgres psql -c "CREATE DATABASE health_check_db;"
else
    echo "Database 'health_check_db' already exists, skipping creation."
fi

# Create user 'meet' if it doesn't exist
USER_EXISTS=$(sudo -H -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='meet'")
if [ "$USER_EXISTS" != "1" ]; then
    sudo -H -u postgres psql -c "CREATE USER meet WITH PASSWORD 'Root@123';"
else
    echo "User 'meet' already exists, skipping creation."
fi

# Grant privileges on the database to user 'meet'
sudo -H -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE health_check_db TO meet;"

# Grant schema-level privileges
sudo -H -u postgres psql -d health_check_db <<'EOF'
GRANT ALL ON SCHEMA public TO meet;
GRANT CREATE ON SCHEMA public TO meet;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO meet;
EOF

# Create system group and user if not present
if ! getent group csye6225app > /dev/null; then
    sudo groupadd csye6225app
fi
if ! id -u csye6225user > /dev/null 2>&1; then
    sudo useradd -s /usr/sbin/nologin -g csye6225app -m csye6225user
fi

# Deploy the web application artifact
sudo mkdir -p /opt/csye6225/webapp

# Use ARTIFACT_PATH env variable (default to /root/webapp.zip if not set)
ARTIFACT_FILE=${ARTIFACT_PATH:-/root/webapp.zip}
if [ -f "$ARTIFACT_FILE" ]; then
    sudo unzip "$ARTIFACT_FILE" -d /opt/csye6225
else
    echo "Artifact $ARTIFACT_FILE not found. Exiting."
    exit 1
fi

# Rename folder if necessary
if [ -d "/opt/csye6225/webapp_extracted" ]; then
    sudo mv /opt/csye6225/webapp_extracted /opt/csye6225/webapp
fi

# Set proper ownership and permissions
sudo chown -R csye6225user:csye6225app /opt/csye6225
sudo chmod -R 755 /opt/csye6225

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs < /dev/null

# Change to the application directory and install dependencies
if [ -d "/opt/csye6225/webapp" ]; then
    cd /opt/csye6225/webapp || { echo "Directory /opt/csye6225/webapp not found. Exiting."; exit 1; }
else
    echo "Application directory /opt/csye6225/webapp does not exist. Exiting."
    exit 1
fi
npm install

# Create environment file (.env) for the application
echo -e "DB_NAME=health_check_db\nDB_USER=meet\nDB_PASSWORD=Root@123\nDB_HOST=localhost\nDB_PORT=5432\nPORT=8080" | sudo tee .env > /dev/null

# Create systemd service for the application if not already present
if [ ! -f "/etc/systemd/system/csye6225.service" ]; then 
    sudo tee /etc/systemd/system/csye6225.service > /dev/null <<EOF
[Unit]
Description=CSYE6225 Web Application Service
After=network.target

[Service]
Type=simple
User=csye6225user
WorkingDirectory=/opt/csye6225/webapp
ExecStart=/usr/bin/node app.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
fi

# Reload systemd and start the service
sudo systemctl daemon-reload
sudo systemctl enable csye6225
sudo systemctl start csye6225

echo "* Setup complete! *"
echo "Setup completed successfully!"
