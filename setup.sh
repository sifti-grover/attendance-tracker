#!/bin/bash

# QR Attendance System - Quick Setup Script
echo "🚀 Setting up QR Attendance System..."

# Check if Supabase CLI is available
if ! command -v npx &> /dev/null; then
    echo "❌ Node.js/npm not found. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js/npm found"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "✅ Project directory confirmed"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✅ Dependencies installed"

# Check if Supabase is initialized
if [ ! -f "supabase/config.toml" ]; then
    echo "🔧 Initializing Supabase..."
    npx supabase init
fi

echo "✅ Supabase initialized"

echo ""
echo "🎯 Next Steps:"
echo ""
echo "3. Link to your Supabase project:"
echo "   npx supabase link --project-ref nhdfubrmkuojscdnooco"
echo ""
echo "4. Apply database migration:"
echo "   npx supabase db push"
echo ""
echo "5. Deploy Edge Function:"
echo "   npx supabase functions deploy send-qr-batch"
echo ""
echo "6. Start development server:"
echo "   npm run dev"
echo ""
echo "📚 For detailed instructions, see: EDGE_FUNCTION_GUIDE.md"
echo "🎉 Setup complete! Happy coding!"
