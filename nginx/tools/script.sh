#!/bin/bash

mkdir -p /etc/nginx/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/server.key -out /etc/nginx/ssl/server.crt \
    -subj "/C=US/ST=State/L=City/O=Company/OU=IT/CN=achatzit"

exec nginx -g "daemon off;"
