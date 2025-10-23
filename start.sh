#!/bin/bash
# Start script for SOC Dashboard (Rocky Linux)

# Create venv only if it doesn’t exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate

# Install dependencies
pip install -r requirements.txt --break-system-packages

# Run server
python3 server.py
