#!/bin/sh
set -e

echo "Applying database migrations..."
node_modules/.bin/prisma migrate deploy

echo "Starting server..."
exec node_modules/.bin/next start
