#!/bin/bash
# Supabase CLI Helper Commands
# Usage: source .supabase-helpers.sh

PROJECT_REF="ecdrxtbclxfpkknasmrw"

alias sb='supabase'
alias sb-functions='supabase functions list'
alias sb-projects='supabase projects list'
alias sb-secrets='supabase secrets list'

# Function to open logs in browser
sb-logs() {
  local function_name=${1:-brand-coach-gpt}
  echo "Opening logs for: $function_name"
  open "https://supabase.com/dashboard/project/${PROJECT_REF}/logs/edge-functions?search=${function_name}"
}

# Function to deploy edge function
sb-deploy() {
  local function_name=$1
  if [ -z "$function_name" ]; then
    echo "Usage: sb-deploy <function-name>"
    return 1
  fi
  supabase functions deploy $function_name --project-ref $PROJECT_REF
}

echo "✅ Supabase helpers loaded!"
echo "Available commands:"
echo "  sb-functions     - List all Edge Functions"
echo "  sb-logs [name]   - Open logs in browser (default: brand-coach-gpt)"
echo "  sb-deploy <name> - Deploy an Edge Function"
echo "  sb-projects      - List all projects"
echo "  sb-secrets       - List secrets"
