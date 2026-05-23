# 孕宝助手 PWA

## 网址
https://mmayi3344.github.io/bbmmabb/

## 技术栈
- 纯前端 PWA（HTML + CSS + JS）
- 数据存储在浏览器 localStorage（每人独立）
- Service Worker 离线缓存
- GitHub Pages 托管

## 功能模块

| Tab | 功能 |
|------|------|
| 🏠 首页 | 预产期倒计时、40周进度、宝宝大小、每周贴士 |
| 🤰 孕期 | 胎动计数（合并窗口3/5/10分钟）、体重记录、产检提醒 |
| 👶 宝宝 | 哺乳计时（左右分别）、尿布记录、生长曲线、睡眠日志 |
| 💉 疫苗 | 国标接种时间表，点选标记 |
| 📝 笔记 | 孕期日记/育儿笔记 |

## 更新方法

1. 修改 `index.html`、`sw.js` 等文件
2. 提交并推送到 GitHub
3. GitHub Pages 自动部署（~1分钟生效）
4. 手机强制刷新（清除缓存）

## Git 仓库
https://github.com/mmayi3344/bbmmabb

## 强制刷新方法
- iPhone Safari：地址栏 → aA → 重新载入网站
- Android Chrome：地址栏 → 🔒 → 网站设置 → 清除并重置

## 缓存版本
sw.js CACHE 版本号递增即可强制更新所有客户端缓存
