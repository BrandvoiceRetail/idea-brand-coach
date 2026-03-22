#!/bin/bash
# Start full local development environment with Docker
#
# Usage: ./scripts/dev-docker.sh [simple|full]
#   simple - Uses Supabase CLI for backend (recommended)
#   full   - Runs all services in Docker (standalone)

set -e

MODE=${1:-simple}

case $MODE in
  simple)
    echo "Starting with Supabase CLI backend..."
    echo ""

    # Check if Supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
      echo "Error: Supabase CLI not installed"
      echo "Install with: brew install supabase/tap/supabase"
      exit 1
    fi

    # Start Supabase if not running
    if ! supabase status &> /dev/null; then
      echo "Starting Supabase..."
      supabase start
    else
      echo "Supabase already running"
    fi

    echo ""
    echo "Starting frontend container..."
    docker-compose -f docker-compose.simple.yml up --build
    ;;

  full)
    echo "Starting full Docker stack (standalone)..."
    echo ""
    docker-compose up --build
    ;;

  *)
    echo "Usage: ./scripts/dev-docker.sh [simple|full]"
    echo ""
    echo "Options:"
    echo "  simple - Uses Supabase CLI for backend (recommended)"
    echo "  full   - Runs all services in Docker (standalone)"
    exit 1
    ;;
esac
