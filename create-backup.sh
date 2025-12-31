#!/bin/bash

# Create backup script for Build Profit Solutions
# Usage: ./create-backup.sh

BACKUP_DIR="$HOME/app-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/build-profit-solutions-backup-$TIMESTAMP.tar.gz"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Creating backup..."
echo "Project: $PROJECT_DIR"
echo "Backup file: $BACKUP_FILE"

cd "$PROJECT_DIR" || exit 1

tar -czf "$BACKUP_FILE" \
  --exclude='node_modules' \
  --exclude='.expo' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='mobile-backup.tar.gz' \
  --exclude='app-backups' \
  --exclude='.git/objects' \
  .

if [ $? -eq 0 ]; then
  BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
  echo "✅ Backup created successfully!"
  echo "   File: $BACKUP_FILE"
  echo "   Size: $BACKUP_SIZE"
  echo ""
  echo "Recent backups:"
  ls -lht "$BACKUP_DIR" | grep "build-profit-solutions-backup" | head -5
else
  echo "❌ Backup failed!"
  exit 1
fi


