#!/bin/bash
# Simple wrapper to clear user data with environment variables loaded
# Usage: ./scripts/clear-data.sh <user_id> [--keep-chat]

# Load environment variables from .env
export $(cat .env | xargs)

# Run the TypeScript script
npx tsx scripts/clear-user-data.ts "$@"
