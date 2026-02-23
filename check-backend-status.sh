#!/bin/bash

echo "🔍 Checking Backend Status"
echo "=========================="
echo ""

# Check port 3001
echo "Port 3001 (Main API):"
if lsof -i :3001 > /dev/null 2>&1; then
    echo "  ✅ Port 3001 is in use"
    lsof -i :3001 | grep LISTEN
    echo ""
    echo "  Testing health endpoint..."
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "  ✅ Health check: OK"
        curl -s http://localhost:3001/health | head -3
    else
        echo "  ❌ Health check: FAILED (backend may have crashed)"
        echo "  💡 Try restarting: cd backend && npm start"
    fi
else
    echo "  ❌ Port 3001 is NOT in use"
    echo "  💡 Backend is not running"
fi

echo ""

# Check port 3000
echo "Port 3000 (Secondary API):"
if lsof -i :3000 > /dev/null 2>&1; then
    echo "  ✅ Port 3000 is in use"
    lsof -i :3000 | grep LISTEN
    echo ""
    echo "  Testing health endpoint..."
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "  ✅ Health check: OK"
        curl -s http://localhost:3000/health | head -3
    else
        echo "  ❌ Health check: FAILED (backend may have crashed)"
    fi
else
    echo "  ❌ Port 3000 is NOT in use"
    echo "  💡 Backend is not running"
fi

echo ""
echo "=========================="
echo ""
echo "📋 Summary:"
if lsof -i :3001 > /dev/null 2>&1 && curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is RUNNING and healthy"
elif lsof -i :3001 > /dev/null 2>&1; then
    echo "⚠️  Backend process exists but health check FAILED"
    echo "   The backend may have crashed or errored"
    echo "   Check the terminal where you started it for errors"
else
    echo "❌ Backend is NOT running"
    echo "   Start it with: cd backend && npm start"
fi
