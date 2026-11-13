#!/usr/bin/env bash

set -ux

echo "Starting backend..."
./plugin-backend --loglevel info --config ./config/config.yaml &
backend=$!

echo "Running tests..."
cd web
# Hard wall-clock cap: if the browser wedges (e.g. app stuck in a render/compute loop), Cypress'
# own timeouts never fire, and the CI pod would otherwise run until the 8h prow timeout, which
# kills the pod and loses all logs. Exiting on our own terms keeps the output.
NO_COLOR=1 timeout -k 30s "${TEST_TIMEOUT:-30m}" npm run cypress:run
cypress=$?
# 124: killed by timeout's SIGTERM. 137: outlived it and needed the -k SIGKILL.
if [ $cypress -eq 124 ] || [ $cypress -eq 137 ]; then
  echo "ERROR: cypress run exceeded ${TEST_TIMEOUT:-30m} and was killed"
fi

kill $backend
wait $backend

exit $cypress
