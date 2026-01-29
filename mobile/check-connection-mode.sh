#!/bin/bash

# Script to check what connection mode Expo is actually using

echo "🔍 Checking Expo Connection Mode..."
echo ""

# Check if Expo is running
if ! pgrep -f "expo start" > /dev/null; then
    echo "❌ Expo is not running"
    echo "   Start it with: npx expo start"
    exit 1
fi

# Check the process command
EXPO_CMD=$(ps aux | grep "expo start" | grep -v grep | head -1 | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}')

echo "📋 Expo Process Command:"
echo "   $EXPO_CMD"
echo ""

# Determine mode from command
if echo "$EXPO_CMD" | grep -q "\--tunnel"; then
    echo "✅ Mode: TUNNEL (--tunnel flag detected)"
    echo "   Connection URL should be: exp://...exp.direct/..."
elif echo "$EXPO_CMD" | grep -q "\--lan"; then
    echo "✅ Mode: LAN (--lan flag detected)"
    echo "   Connection URL should be: exp://192.168.x.x:19000"
elif echo "$EXPO_CMD" | grep -q "\--localhost"; then
    echo "✅ Mode: LOCALHOST (--localhost flag detected)"
    echo "   Connection URL should be: exp://localhost:8081"
else
    echo "⚠️  Mode: DEFAULT (likely LAN)"
    echo "   Default is LAN mode unless --tunnel or --localhost is specified"
fi

echo ""
echo "💡 To see the actual connection URL:"
echo "   1. Look at the terminal where you ran 'npx expo start'"
echo "   2. Look for a line like:"
echo "      Metro waiting on exp://..."
echo "   3. If you see 'exp.direct' in the URL → Tunnel mode"
echo "   4. If you see '192.168.x.x' → LAN mode"
echo "   5. If you see 'localhost' → Localhost mode"
echo ""














