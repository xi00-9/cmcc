# Webhook Debugger

一键部署的 Webhook 调试工具。`npm start` → 打开浏览器 → 获得专属 webhook 接收地址。

## 功能
- 实时捕获所有 HTTP 请求（JSON/XML/Form/Multipart）
- 完整展示 Headers、Body、Query Params
- 一键回放历史请求
- GitHub 暗色风格 UI
- 零配置，60秒启动

## 快速开始
```bash
git clone https://github.com/xi00-9/webhook-debugger.git
cd webhook-debugger
npm install
npm start
# 打开 http://localhost:3456
```

## 适用场景
- 对接支付宝/微信支付/Stripe 回调
- 调试 GitHub/GitLab/Slack webhook
- 测试第三方 API 集成
- QA 验证 API 回调

## 技术栈
Node.js + Express + SSE 实时推送，源码不到 250 行

## 产品
完整源码 + 部署指南 → [Gumroad 购买](待上传)
