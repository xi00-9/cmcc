# DevUtils CLI

## 开发常用工具箱 — 一个命令搞定

```bash
# 安装
npm install -g ./devutils-cli

# JSON 格式化
echo '{"name":"test","nested":{"key":"value"}}' | devutils jsonfmt

# 时间戳转换
devutils ts2dt 1718000000
devutils dt2ts "2024-06-10 08:00:00"

# JWT 解码
devutils jwtdec eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.xxx

# Base64 编解码
echo "hello world" | devutils b64enc
devutils b64dec aGVsbG8gd29ybGQ=

# 生成 UUID
devutils uuid

# SHA256
echo "password" | devutils hash

# 端口检测
devutils port 3000
```

## 包含工具
- jsonfmt / jsonmin — JSON 格式化/压缩
- ts2dt / dt2ts — 时间戳 ↔ 日期
- b64enc / b64dec — Base64 编解码
- uuid — UUID v4 生成
- jwtdec — JWT 解码（含过期检测）
- port — 端口占用检测
- hash — SHA256 哈希
- ip — 公网 IP 查询

## 为什么你需要这个
不用再打开在线工具网站。不用再写一次性脚本。在终端里一个命令搞定。
