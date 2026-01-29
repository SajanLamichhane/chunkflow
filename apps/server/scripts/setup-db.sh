#!/bin/bash

# ChunkFlow Database Setup Script
# This script creates and initializes the PostgreSQL database

set -e

DB_NAME="chunkflow"
DB_USER="${USER}"
DB_HOST="localhost"

echo "🔧 Setting up ChunkFlow database..."

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running on $DB_HOST"
    echo "Please start PostgreSQL first"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Check if database exists
if psql -h $DB_HOST -U $DB_USER -d postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "⚠️  Database '$DB_NAME' already exists"
    read -p "Do you want to drop and recreate it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Dropping database '$DB_NAME'..."
        psql -h $DB_HOST -U $DB_USER -d postgres -c "DROP DATABASE $DB_NAME;"
    else
        echo "Skipping database creation"
        exit 0
    fi
fi

# Create database
echo "📦 Creating database '$DB_NAME'..."
psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"

# Initialize schema
echo "🏗️  Initializing database schema..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$SCRIPT_DIR/../init.sql"

echo "✅ Database setup complete!"
echo ""
echo "Connection string: postgresql://$DB_USER@$DB_HOST:5432/$DB_NAME"
echo ""
echo "You can now start the server with: pnpm run start:dev"
