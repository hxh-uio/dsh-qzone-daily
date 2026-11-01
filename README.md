# dsh-qzone-daily · 小鲸鱼 QQ空间科普日更插件

让 DSH（DeepSeek Harness）里的 agent 每天自动按**五大洲循环**，发一篇「历史 / 文明」四轴时间线说说（**每句标出处**），并巡检评论区耐心回复。

> 开源版由在跑栈里的 `dsh-bili-whale` 内嵌 `qzone-daily` 抽取、脱敏、独立成包。
> 不依赖 bilibili，可单独作为 DSH bundle 启用。

---

## 它做什么

- **自主日更**：每 60s 轮询；到点（默认 20:00）且今天没发过 → 往目标会话塞一个「日更任务」回合。
- **四轴时间线**：史 / 经 / 俗 / 美，古→今，最精炼卡片式。
- **强制出处标注**：每条事实可溯源，不标出处不算合格（人设 / 框架约束）。
- **评论区恢复**：发完约 10 分钟后拉评论，对合理提问 / 纠错耐心、标出处地回复；引战 / 广告忽略。
- **五大洲课程表**：亚洲→欧洲→非洲→美洲→大洋洲，每天一国，25 个切片（见 `assets/CONTENT_FRAMEWORK.md`）。

---

## 依赖

1. **DSH（DeepSeek Harness）** 运行环境，插件机制启用。
2. 提供 **`sessionController`** 的宿主（DSH 注入，本插件 `inject: ['sessionController']`）。
3. 目标 agent 会话已接入以下工具（通常来自 SnowLuma / QQ MCP 那 3 个 MCP）：
   - `web_search` —— 查事实与权威来源
   - `qq_qzone_send` —— 发说说（`ugc_right` 控制可见范围）
   - `qq_qzone_get_detail` —— 拉评论
   - `qq_qzone_comment` —— 回评论
4. 目标 agent 的角色卡 `persona.md` 已写入「青少年版 + 工作状态 + §十 框架」（参考 `assets/PERSONA_TEMPLATE.md`）。

---

## 安装（二选一）

### 方式 A：并入现有 bundle（如 dsh-bili-whale）
把本插件的 `lib/qzone-daily.js` 与 `lib/index.js` 的逻辑合入你的宿主插件，由宿主 `apply(ctx)` 调用 `startQzoneDaily(ctx)` 即可（参考 `lib/index.js`）。

### 方式 B：作为独立 DSH bundle 启用
1. 把本目录放到插件目录，例如：
   ```
   ~/.dsh/plugins/dsh-qzone-daily/
   ```
2. 在 profile 的 `package.json` 增加依赖与 bundles 条目：
   ```json
   "dependencies": { "dsh-qzone-daily": "link:C:/Users/rose/.dsh/plugins/dsh-qzone-daily" },
   "dsh": { "profile": { "bundles": [ "..., "dsh-qzone-daily" ] } }
   ```
3. 于 profile 目录执行安装（需宿主机执行，沙箱内软链受限）：
   ```
   pnpm install
   ```
4. 重启 / 重载 DSH。日志应出现：
   > `[qzone-daily] QQ空间日更调度已启动（每 60s tick；会话 bili-whale-char-xxxxxxxx；默认 20:00）`

---

## 配置

复制模板并填写你的真实值：

```bash
cp config.example.json ~/.dsh/qzone-daily.config.json
```

`~/.dsh/qzone-daily.config.json`：
```json
{
  "enabled": true,
  "hour": 20,
  "minute": 0,
  "ugcRight": 4,
  "sessionId": "bili-whale-char-YOUR_CHAR_ID",
  "cooldownMin": 20
}
```

| 字段 | 说明 |
|------|------|
| `enabled` | 总开关 |
| `hour` / `minute` | 每日触发时间（24h） |
| `ugcRight` | 说说可见范围：`4`=仅好友（默认，符合「禁止公开」），`1`=所有人，`64`=仅自己 |
| `sessionId` | **必填**：你 agent 的真实会话 id（形如 `bili-whale-char-xxxxxxxx`）。未配置则插件启动告警且不投递 |
| `cooldownMin` | 同分钟重复投递的冷却 |

> ⚠️ 真实配置文件 `qzone-daily.config.json` 与状态文件 `qzone-daily-state.json` 已被 `.gitignore` 忽略，**不会进仓库**。

---

## 落盘文件（均在 `~/.dsh/`）

- `qzone-daily.config.json` —— 配置（用户填）
- `qzone-daily-state.json` —— 调度状态（上次发布日期 / 下一索引 / 已发篇数）
- `whale-work/` —— 会话 create 用的工作目录（与 bili-whale 共用）

---

## 内容运营框架

完整选题表、四轴结构、出处规范、评论区恢复机制见 `assets/CONTENT_FRAMEWORK.md`。
人设模板（青少年版 + 工作状态 + §十 框架，已脱敏）见 `assets/PERSONA_TEMPLATE.md`。

---

## 安全 / 隐私

- 本仓库**不含**任何真实 QQ 号、私人会话 id、token 或凭据；所有私密项均为占位符或 `.gitignore` 排除。
- 默认 `ugc_right = 4`（仅好友），遵循「不公开」原则；如需更公开请自行改配置。
- 配图要求使用**人类生产**的真实图片（摄影 / 书籍扫描），严禁 AI 生图。

## License

[MIT](./LICENSE)
