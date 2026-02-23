#!/bin/bash
# Start the AI Backend on port 3000

cd "$(dirname "$0")/bps-ai-backend"

# Check if .env exists, if not create a template
if [ ! -f .env ]; then
  echo "⚠️  No .env file found. Creating template..."
  echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
  echo "📝 Please edit bps-ai-backend/.env and add your OpenAI API key"
  echo "   Then run this script again."
  exit 1
fi

echo "🚀 Starting AI Backend on port 3000..."
npm run dev
