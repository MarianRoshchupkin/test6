#!/bin/sh
set -e

mkdir -p /app/node_modules /app/.webpack-cache

chown -R app:app /app/node_modules /app/.webpack-cache 2>/dev/null || true

if [ "$#" -eq 0 ]; then
  set -- npm run start
fi

exec su -s /bin/sh app -c "$*"