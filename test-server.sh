#!/bin/bash
# Quick test server for local development

echo "Starting local server at http://localhost:8000"
echo "Visit:"
echo "  - Homepage: http://localhost:8000/"
echo "  - Living Docs: http://localhost:8000/living-docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

python3 -m http.server 8000
