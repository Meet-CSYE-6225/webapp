#!/bin/bash

# Update packages
sudo apt update -y
sudo apt upgrade -y

# Install PostgreSQL and unzip
sudo apt install postgresql postgresql-contrib unzip -y

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Update PostgreSQL configuration for remote connections
# Set listen_addresses to '*' in postgresql.conf
sudo sed -i "s/^#\?listen_addresses\s*=.*/listen_addresses = '*'/" /etc/postgresql/16/main/postgresql.conf

# Add a rule to pg_hba.conf 
grep -q "^host\s\+all\s\+all\s\+0.0.0.0/0\s\+md5" /etc/postgresql/16/main/pg_hba.conf || \
    echo "host    all    all    0.0.0.0/0    md5" | sudo tee -a /etc/postgresql/16/main/pg_hba.conf

# Restart PostgreSQL to apply configuration changes
sudo systemctl restart postgresql

# Check if the database 'health_check_db' exists: if not, create it
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='health_check_db'")
if [ "$DB_EXISTS" != "1" ]; then
    sudo -u postgres psql -c "CREATE DATABASE health_check_db;"
else
    echo "Database 'health_check_db' already exists, Skipping creation"
fi

# Check if the user 'meet' exists; if not: create it
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='meet'")
if [ "$USER_EXISTS" != "1" ]; then
    sudo -u postgres psql -c "CREATE USER meet WITH PASSWORD 'Root@123';"
else
    echo "User 'meet' already exists, Skipping creation."
fi

# Grant privileges on the database to the user meet
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE health_check_db TO meet;"

# Grant schema-level privileges 
sudo -u postgres psql -d health_check_db <<'EOF'
GRANT ALL ON SCHEMA public TO health_check_db;
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

# Deploy app to /opt/csye6225
sudo mkdir -p /opt/csye6225
# Unzip the app
sudo unzip "/root/webapp-fork.zip" -d /opt/csye6225

if [ -d "/opt/csye6225/webapp-fork 2" ]; then
    sudo mv "/opt/csye6225/webapp-fork 2" /opt/csye6225/webapp-fork
fi

# Set ownership and permissions
sudo chown -R csye6225user:csye6225app /opt/csye6225
sudo chmod -R 755 /opt/csye6225

# Install Node.js 
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install nodejs -y

# Change directory to the app folder
cd /opt/csye6225/webapp-fork || { echo "Directory /opt/csye6225/webapp-fork not found. Exiting."; exit 1; }



    npm install


# Create environment variables file (.env)
echo -e "DB_NAME=health_check_db\nDB_USER=meet\nDB_PASSWORD=Root@123\nDB_HOST=10.116.0.3\nDB_PORT=5432\nPORT=8080" | sudo tee .env > /dev/null

echo "Setup completed successfully!"