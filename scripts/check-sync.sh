#!/bin/bash
# Simple wrapper to check field sync status with environment variables loaded
# Usage: ./scripts/check-sync.sh <user_id>

# Load environment variables from .env
export $(cat .env | xargs)

# Run the TypeScript script
npx tsx scripts/check-field-sync-status.ts "$@"
