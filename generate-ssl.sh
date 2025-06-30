#!/bin/bash

# Generate self-signed SSL certificates for MintSprout Docker deployment

echo "Generating self-signed SSL certificates for MintSprout..."

# Create ssl directory if it doesn't exist
mkdir -p ssl

# Generate private key
openssl genrsa -out ssl/nginx-selfsigned.key 2048

# Generate certificate
openssl req -new -x509 -key ssl/nginx-selfsigned.key -out ssl/nginx-selfsigned.crt -days 365 -subj "/C=US/ST=State/L=City/O=MintSprout/OU=IT/CN=localhost"

# Set appropriate permissions
chmod 600 ssl/nginx-selfsigned.key
chmod 644 ssl/nginx-selfsigned.crt

echo "SSL certificates generated successfully!"
echo "Private key: ssl/nginx-selfsigned.key"
echo "Certificate: ssl/nginx-selfsigned.crt"
echo ""
echo "You can now run: docker-compose --profile production up -d"