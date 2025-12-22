#!/bin/bash

# Test Google Places API Key
# This helps identify which project the key belongs to

API_KEY="AIzaSyAoN6cUpD0EHowfA-_Bk_5GFSY0v93Dsfg"

echo "Testing Google Places API Key..."
echo "API Key: ${API_KEY:0:20}..."
echo ""

echo "Testing Places Autocomplete API..."
RESPONSE=$(curl -s "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=test&key=$API_KEY")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "If you see 'REQUEST_DENIED' with 'legacy API not enabled':"
echo "1. Go to: https://console.cloud.google.com/"
echo "2. Switch to the project that contains this API key"
echo "3. Enable Places API (Legacy) at: https://console.cloud.google.com/apis/library/places-backend.googleapis.com"
echo "4. Wait 1-2 minutes and try again"

