# webapp
Health Check API

This is a simple Node.js-based API for performing health checks on a PostgreSQL database. It ensures database and table existence, performs health check entries

Prerequisites

Node.js 

PostgreSQL database

dotenv package for environment variable management

Installation:
    -> Clone the repository:
        git clone <repository-url>

    -> Install dependencies:
        npm install

    -> Set up environment variables by creating a .env file in the root directory:
        DB_NAME=your_database_name
        DB_USER=your_database_user
        DB_PASSWORD=your_database_password
        DB_HOST=your_database_host
        DB_PORT=your_database_port
        PORT=your_app_port

Error Handling

    -> If the database is unavailable, the health check will return 503 Service Unavailable.   
    -> Unsupported methods on /healthz return 405 Method Not Allowed.
    -> Requests with query parameters or a body on /healthz return 400 Bad Request.