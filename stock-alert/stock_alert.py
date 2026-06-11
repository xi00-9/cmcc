#!/usr/bin/env python3
"""Stock Alert - Real-time A-stock price monitor with desktop notifications"""
import json, time, urllib.request, sys, os

# Config
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'watchlist.json')
CHECK_INTERVAL = 30  # seconds

DEFAULT_WATCHLIST = {
    "stocks": [
        {"code": "sh600519", "name": "茅台", "alert_above": 1400, "alert_below": 1200, "enabled": True},
        {"code": "sz002594", "name": "比亚迪", "alert_above": 100, "alert_below": 80, "enabled": True},
        {"code": "sz300059", "name": "东方财富", "alert_above": 20, "alert_below": 15, "enabled": True},
    ]
}

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    save_config(DEFAULT_WATCHLIST)
    return DEFAULT_WATCHLIST

def save_config(cfg):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(cfg, f, indent=2)

def fetch_price(code):
    """Fetch current price from Sina Finance API"""
    try:
        url = f"https://hq.sinajs.cn/list={code}"
        req = urllib.request.Request(url, headers={'Referer': 'https://finance.sina.com.cn'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read().decode('gbk')
        parts = data.split('"')[1].split(',')
        if len(parts) < 4:
            return None
        return {
            'name': parts[0],
            'price': float(parts[3]),
            'change': round((float(parts[3]) - float(parts[2])) / float(parts[2]) * 100, 2),
            'high': float(parts[4]),
            'low': float(parts[5]),
            'volume': int(float(parts[8])) if parts[8] else 0
        }
    except Exception as e:
        return None

def desktop_notify(title, msg):
    """Cross-platform desktop notification"""
    if sys.platform == 'win32':
        try:
            from win10toast import ToastNotifier
            ToastNotifier().show_toast(title, msg, duration=5)
        except:
            print(f"\n  [ALERT] {title}: {msg}\n")
    elif sys.platform == 'darwin':
        os.system(f'osascript -e \'display notification "{msg}" with title "{title}"\'')
    else:
        os.system(f'notify-send "{title}" "{msg}"')

def main():
    print("  Stock Alert Monitor")
    print("  Press Ctrl+C to stop\n")

    cfg = load_config()
    alerts = {}

    for s in cfg['stocks']:
        alerts[s['code']] = {'alerted_above': False, 'alerted_below': False}

    try:
        while True:
            print(f"\r  {'='*50}")
            for stock in cfg['stocks']:
                if not stock.get('enabled', True):
                    continue
                data = fetch_price(stock['code'])
                if not data:
                    print(f"  {stock['name']}: fetch failed")
                    continue

                direction = "🟢" if data['change'] > 0 else "🔴" if data['change'] < 0 else "⚪"
                print(f"  {direction} {data['name']:6s} ¥{data['price']:<8.2f} {data['change']:+.2f}%")

                # Check alerts
                code = stock['code']
                if stock.get('alert_below') and data['price'] < stock['alert_below']:
                    if not alerts[code]['alerted_below']:
                        desktop_notify(f"跌破警报: {data['name']}",
                                      f"当前 {data['price']} < 警戒 {stock['alert_below']}")
                        alerts[code]['alerted_below'] = True
                else:
                    alerts[code]['alerted_below'] = False

                if stock.get('alert_above') and data['price'] > stock['alert_above']:
                    if not alerts[code]['alerted_above']:
                        desktop_notify(f"突破警报: {data['name']}",
                                      f"当前 {data['price']} > 目标 {stock['alert_above']}")
                        alerts[code]['alerted_above'] = True
                else:
                    alerts[code]['alerted_above'] = False

            time.sleep(CHECK_INTERVAL)
    except KeyboardInterrupt:
        print("\n  Stopped.")

if __name__ == '__main__':
    main()
