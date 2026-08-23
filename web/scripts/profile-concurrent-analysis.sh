#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
CONCURRENCY="${MONITOR_CONCURRENCY:-2}"
ROUNDS="${MONITOR_ROUNDS:-3}"
INTERVAL_SECONDS="${PROFILE_INTERVAL_SECONDS:-0.2}"
OUTPUT_DIR="${PROFILE_OUTPUT_DIR:-/tmp/traininggov-profile-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUTPUT_DIR"

npm run build >"$OUTPUT_DIR/build.log" 2>&1
./node_modules/.bin/next start -p "$PORT" >"$OUTPUT_DIR/server.log" 2>&1 &
APP_PID=$!
cleanup() {
  kill "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
}
trap cleanup EXIT

for attempt in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:${PORT}/" >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent "http://127.0.0.1:${PORT}/" >/dev/null
LISTENER_PID="$(fuser -n tcp "$PORT" 2>/dev/null | tr -cs '0-9' ' ' | awk '{print $1}')"
if [ -n "$LISTENER_PID" ]; then APP_PID="$LISTENER_PID"; fi

printf 'timestamp_ms,pid,cpu_percent,rss_kb,vsz_kb,elapsed_s\n' >"$OUTPUT_DIR/samples.csv"
(
  while kill -0 "$APP_PID" 2>/dev/null; do
    ps -p "$APP_PID" -o pid=,pcpu=,rss=,vsz=,etime= | awk -v timestamp_ms="$(date +%s%3N)" '{gsub(/^ +| +$/, ""); gsub(/ +/, ","); print timestamp_ms "," $0}' >>"$OUTPUT_DIR/samples.csv"
    sleep "$INTERVAL_SECONDS"
  done
) &
SAMPLER_PID=$!

BASE_URL="http://127.0.0.1:${PORT}" MONITOR_CONCURRENCY="$CONCURRENCY" MONITOR_ROUNDS="$ROUNDS" npm run monitor:api-latency >"$OUTPUT_DIR/monitor.json" 2>&1
kill "$SAMPLER_PID" 2>/dev/null || true
wait "$SAMPLER_PID" 2>/dev/null || true

awk -F, 'NR==2 {minCpu=$3; maxCpu=$3; minRss=$4; maxRss=$4} NR>1 {sumCpu+=$3; sumRss+=$4; count++; if($3>maxCpu)maxCpu=$3; if($3<minCpu)minCpu=$3; if($4>maxRss)maxRss=$4; if($4<minRss)minRss=$4} END {printf "{\n  \"serverPid\": %s,\n  \"sampleCount\": %d,\n  \"cpuPercent\": {\"min\": %.2f, \"mean\": %.2f, \"max\": %.2f},\n  \"rssKb\": {\"min\": %d, \"mean\": %.0f, \"max\": %d}\n}\n", "'"$APP_PID"'", count, minCpu, sumCpu/count, maxCpu, minRss, sumRss/count, maxRss}' "$OUTPUT_DIR/samples.csv" >"$OUTPUT_DIR/summary.json"
printf '%s\n' "$OUTPUT_DIR"
