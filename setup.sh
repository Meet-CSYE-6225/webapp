#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

# Update packages
sudo apt update -y
sudo apt upgrade -y

# Add PostgreSQL APT Repository
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | sudo tee /usr/share/keyrings/postgresql.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

# Install PostgreSQL and required packages
sudo apt update
sudo apt install -y postgresql-14 postgresql-contrib-14 unzip curl nodejs npm

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Update PostgreSQL configuration for remote connections
sudo sed -i "s/^#\?listen_addresses\s*=.*/listen_addresses = '*'/" /etc/postgresql/14/main/postgresql.conf

# Append pg_hba.conf rule for remote connections (using sudo to overcome permission issues)
if ! sudo grep -q "^host\s\+all\s\+all\s\+0.0.0.0/0\s\+md5" /etc/postgresql/14/main/pg_hba.conf; then
    echo "host    all    all    0.0.0.0/0    md5" | sudo tee -a /etc/postgresql/14/main/pg_hba.conf
fi

# Restart PostgreSQL to apply configuration changes
sudo systemctl restart postgresql

# Create database 'health_check_db' if it doesn't exist
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='health_check_db'")
if [ "$DB_EXISTS" != "1" ]; then
    sudo -u postgres psql -c "CREATE DATABASE health_check_db;"
else
    echo "Database 'health_check_db' already exists, skipping creation."
fi

# Create user 'meet' if it doesn't exist
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='meet'")
if [ "$USER_EXISTS" != "1" ]; then
    sudo -u postgres psql -c "CREATE USER meet WITH PASSWORD 'Root@123';"
else
    echo "User 'meet' already exists, skipping creation."
fi

# Grant privileges on the database to user 'meet'
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE health_check_db TO meet;"

# Grant schema-level privileges (only grant to user 'meet')
sudo -u postgres psql -d health_check_db <<'EOF'
GRANT ALL ON SCHEMA public TO meet;
GRANT CREATE ON SCHEMA public TO meet;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO meet;
EOF

# Create app group and user if they do not exist
if ! getent group csye6225app > /dev/null; then
    sudo groupadd csye6225app
fi
if ! id -u csye6225user > /dev/null 2>&1; then
    sudo useradd -s /bin/bash -g csye6225app -m csye6225user
fi

# Prepare deployment directory
sudo mkdir -p /opt/csye6225

# Unzip the application archive from /root/webapp.zip
if [ -f "/root/webapp.zip" ]; then
    sudo unzip "/root/webapp.zip" -d /opt/csye6225
else
    echo "webapp.zip not found in /root. Please ensure the file exists."
    exit 1
fi

# Rename or adjust extracted folder if necessary
# (Assuming the zip extracts a folder named 'webapp_extracted', change as needed)
if [ -d "/opt/csye6225/webapp_extracted" ]; then
    sudo mv "/opt/csye6225/webapp_extracted" "/opt/csye6225/webapp"
fi

# Set ownership and permissions
sudo chown -R csye6225user:csye6225app /opt/csye6225
sudo chmod -R 755 /opt/csye6225

# Install Node.js (from NodeSource)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Change directory to the application folder
if [ -d "/opt/csye6225/webapp" ]; then
    cd /opt/csye6225/webapp || { echo "Directory /opt/csye6225/webapp not found. Exiting."; exit 1; }
else
    echo "Application directory /opt/csye6225/webapp does not exist. Exiting."
    exit 1
fi

# Install Node.js dependencies
npm install

# Create environment variables file (.env)
cat <<EOF | sudo tee .env > /dev/null
DB_NAME=health_check_db
DB_USER=meet
DB_PASSWORD=Root@123
DB_HOST=localhost
DB_PORT=5432
PORT=8080
EOF

# Create systemd service file for the web application if it doesn't exist
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

# Reload systemd, enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable csye6225
sudo systemctl start csye6225

echo "* Setup complete! *"
echo "Setup completed successfully!"
