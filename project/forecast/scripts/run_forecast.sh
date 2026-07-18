#!/usr/bin/env bash
# 一键抓取全部数据落盘到 cache/YYYYMMDD/，随后由 Claude 按 SKILL.md 分析
set -uo pipefail
cd "$(dirname "$0")/.."
SK=skills/market-forecast
DATE=$(date +%Y%m%d)

echo "=== 抓取数据 $(date '+%Y-%m-%d %H:%M') ==="
python3 "$SK/fetch_quote.py"
python3 "$SK/fetch_overseas.py"
python3 "$SK/fetch_flow.py" || echo "[flow] 降级跳过"
python3 "$SK/fetch_flow_intraday.py" || echo "[flow_intraday] 降级跳过"
python3 "$SK/fetch_sentiment.py" || echo "[sentiment] 降级跳过"
python3 "$SK/fetch_earnings.py" || echo "[earnings] 降级跳过"
python3 "$SK/fetch_news.py" || echo "[news] 降级跳过"

echo "=== 数据就绪 cache/$DATE/ ==="
ls -1 "cache/$DATE/" 2>/dev/null

# 时点判断: <15:00 盘中预测今日收盘, >=15:00 收盘后预测次日
H=$(date +%H%M)
if [ "$H" -lt 1500 ]; then
  echo "时点: 盘中 → 预测【今日收盘】方向"
else
  echo "时点: 收盘后 → 预测【次日】方向"
fi
