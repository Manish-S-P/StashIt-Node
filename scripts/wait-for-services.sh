#!/usr/bin/env bash
# Waits until MongoDB (port 27017) and S3 storage (port 9000) accept connections.
set -euo pipefail

for i in $(seq 1 45); do
  if (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && curl -s -o /dev/null http://127.0.0.1:9000/health; then
    echo "MongoDB and storage are up"
    exit 0
  fi
  sleep 2
done

echo "MongoDB or storage did not start in time" >&2
exit 1
