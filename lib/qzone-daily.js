// dsh-qzone-daily · QQ空间科普日更调度（独立插件版）
//
// 做法：
//   · 每 60 秒 tick；到点（默认 20:00）且今天还没发过 → 用 ctx.sessionController 往目标
//     会话（sessionId，配置指定）塞一个「日更任务」回合；
//   · agent 醒来后用 web_search 查事实 + qq_qzone_send 发文（ugc_right 见配置）+ qq_qzone_get_detail/comment 回评。
//
// 课程表与提示词来源：assets/CONTENT_FRAMEWORK.md。史实/出处由 agent 运行时现查，避免硬编码出错。
// 本文件不依赖 bili-whale，可单独作为 DSH bundle 启用。

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const WORK_DIR = path.join(DSH_HOME, 'whale-work')
const STATE_FILE = path.join(DSH_HOME, 'qzone-daily-state.json')
const CFG_FILE = path.join(DSH_HOME, 'qzone-daily.config.json')

const DEFAULTS = {
  enabled: true,
  hour: 20, // 默认每晚 20:00
  minute: 0,
  ugcRight: 4, // 仅好友可见（=4）；人设卡禁止用 1（所有人可见）。可改 64 = 仅自己。
  // ⚠️ 开源占位：部署前务必改成你 agent 的真实会话 id（形如 bili-whale-char-xxxxxxxx）
  sessionId: 'bili-whale-char-YOUR_CHAR_ID',
  cooldownMin: 20,
}

// ── 五大洲循环课程表（源自 assets/CONTENT_FRAMEWORK.md 选题表）──
export const CURRICULUM = [
  { continent: '亚洲', country: '中国 · 唐', era: '开放帝国与丝路', theme: '万国来朝的开放帝国与丝路命脉' },
  { continent: '亚洲', country: '中国 · 宋', era: '经济革命与市民文化', theme: '一场静悄悄的经济革命与市民烟火' },
  { continent: '亚洲', country: '日本 · 平安', era: '国风与物哀', theme: '国风文化、物哀美学与女性书写' },
  { continent: '亚洲', country: '日本 · 江户', era: '锁国与町人文化', theme: '锁国令下的町人活力与浮世绘' },
  { continent: '亚洲', country: '印度 · 孔雀王朝', era: '佛教与集权', theme: '佛教兴起与早期集权帝国' },
  { continent: '亚洲', country: '印度 · 莫卧儿', era: '伊斯兰—印度美术', theme: '两种文明的美术融合' },
  { continent: '亚洲', country: '波斯 · 阿契美尼德', era: '帝国与行政', theme: '第一个世界性帝国的行政智慧' },
  { continent: '亚洲', country: '朝鲜 · 朝鲜王朝', era: '儒教与谚文', theme: '儒教秩序与谚文创制的文化博弈' },
  { continent: '欧洲', country: '希腊 · 古典', era: '城邦与理性', theme: '城邦实验与理性的黎明' },
  { continent: '欧洲', country: '罗马 · 帝国', era: '法律与工程', theme: '法律系统与工程霸业的帝国' },
  { continent: '欧洲', country: '意大利 · 文艺复兴', era: '人本与艺术', theme: '人本主义如何重塑艺术' },
  { continent: '欧洲', country: '法国 · 大革命', era: '制度与公民', theme: '一场关于制度与公民的重塑' },
  { continent: '欧洲', country: '英国 · 工业革命', era: '机器与现代性', theme: '机器如何把世界拽进现代性' },
  { continent: '欧洲', country: '西班牙 · 黄金世纪', era: '航海与帝国', theme: '航海、帝国与白银的流动' },
  { continent: '非洲', country: '埃及 · 古王国', era: '金字塔与神王', theme: '金字塔、神王与来世信仰' },
  { continent: '非洲', country: '马里 · 帝国', era: '黄金与廷巴克图', theme: '西非黄金帝国与学术之城' },
  { continent: '非洲', country: '埃塞俄比亚 · 阿克苏姆', era: '基督教与贸易', theme: '红海贸易与早期基督教王国' },
  { continent: '非洲', country: '斯瓦希里海岸', era: '印度洋贸易网', theme: '印度洋季风串起的贸易城邦' },
  { continent: '美洲', country: '玛雅', era: '历法与城市', theme: '历法、城市与雨林文明' },
  { continent: '美洲', country: '阿兹特克', era: '帝国与祭祀', theme: '湖上帝国与祭祀秩序' },
  { continent: '美洲', country: '印加', era: '山地产权与道路', theme: '没有文字的帝国如何治理山海' },
  { continent: '美洲', country: '美国 · 独立/西进', era: '建国与扩张', theme: '建国叙事与西进的代价' },
  { continent: '美洲', country: '巴西 · 殖民/帝国', era: '蔗糖与混血', theme: '蔗糖经济与混血社会的成形' },
  { continent: '大洋洲', country: '毛利 / 波利尼西亚', era: '航海与图腾', theme: '凭星辰航海与图腾记忆' },
  { continent: '大洋洲', country: '澳大利亚 · 殖民与原住民', era: '断裂与存续', theme: '殖民断裂与原住民的存续' },
]

export function pickEntry(index) {
  const n = CURRICULUM.length
  const i = ((index % n) + n) % n
  return { entry: CURRICULUM[i], index: i }
}

export function buildPrompt(entry, state = {}) {
  const day = (state.postedCount ?? 0) + 1
  return `【QQ空间日更 · 工作状态】第 ${day} 天

你是青少年版松明子。今天轮到科普日更，目标：

🌍 洲：${entry.continent}
📍 国家 / 文明：${entry.country}
🕰 时代切片：${entry.era}
🎯 一句话主题：${entry.theme}

请按下面规范产出并发布一篇 QQ空间说说（工作状态语气：精准、耐心、每句话标出处）：

1) 标题格式：【${entry.country} · ${entry.era}】${entry.theme}
2) 四轴时间线（古 → 今；每条只写最关键 1–3 行，像一张信息密度极高的卡片，不是论文）：
   · 史：历史事件（王朝更替 / 战争 / 制度变革 / 关键年份）
   · 经：经济发展（农业 / 贸易 / 产业 / 货币 / 技术）
   · 俗：风俗文化（节庆 / 礼制 / 日常 / 信仰 / 饮食）
   · 美：审美发展（艺术 / 服饰 / 建筑 / 文学风格 / 色彩偏好）
3) 结尾强制：📚 出处：①… ②… ③…（书名 / 作者 / 出版社，或权威站点 URL）。拿不准的来源写「待查证」，有争议的内容注明「学界尚有争议」，绝不编造来源。
4) 质量闸（发布前自检）：四轴齐了吗？出处齐了吗？没引战 / 没带货 / 没擦边？全部通过才发。

操作步骤：
- 先用 web_search 查这个国家 / 时代的事实与权威来源（至少 2–3 个来源），确保每一条都可溯源。
- 再用 qq_qzone_send 发布，参数示例：{ "content": "<上面写好的整篇说说>", "ugc_right": 4 }。ugc_right=4 表示仅好友可见，绝不用 1（所有人可见，人设卡禁止公开）。
- 发布后记下返回结果里的 tid（说说 ID）；约 10 分钟后用 qq_qzone_get_detail（{ "tid": "<返回的tid>", "num": 10 }）拉评论，对合理的提问 / 补充用 qq_qzone_comment（{ "content": "<你的回复>", "tid": "<同 tid>" }）耐心、准确、同样标出处地回复；纯引战 / 广告 / 无意义刷屏安静忽略即可，不要回。
- 如果今天已经发过（状态显示今日已发布），那就只做评论区巡检与回复，不要重复发。

记住：工作状态 = 有耐心、知识精准、标出处；日常聊天仍是温柔少女底色，但科普内容走工作状态语气。`
}

// ── 配置 / 状态读写 ──
function readConfig() {
  let u = {}
  try {
    u = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'))
  } catch {}
  return { ...DEFAULTS, ...u }
}
function readState() {
  try {
    return { lastPostedDate: null, nextIndex: 0, postedCount: 0, lastFiredAt: 0, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }
  } catch {
    return { lastPostedDate: null, nextIndex: 0, postedCount: 0, lastFiredAt: 0 }
  }
}
function writeState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n')
}
const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

async function deliver(controller, sessionId, cwd, text) {
  await controller.create({ sessionId, cwd }).catch(() => {})
  await controller.prompt(
    { requestId: 'qzone-' + Date.now(), sessionId, mode: 'queue', content: [{ type: 'text', text }] },
    AbortSignal.timeout(60_000)
  )
}

/** 单次调度判断 + 投递。返回 { fired, reason, prompt? } */
export async function tickQzoneDaily(ctx, { now = new Date(), dryRun = false } = {}) {
  const cfg = readConfig()
  if (!cfg.enabled) return { fired: false, reason: 'disabled' }
  const st = readState()
  const due = now.getHours() > cfg.hour || (now.getHours() === cfg.hour && now.getMinutes() >= cfg.minute)
  if (!due) return { fired: false, reason: 'not-due' }
  if (st.lastPostedDate === todayStr(now)) return { fired: false, reason: 'already-today' }
  if (Date.now() - (st.lastFiredAt || 0) < cfg.cooldownMin * 60_000) return { fired: false, reason: 'cooldown' }

  const idx = pickEntry(st.nextIndex).index
  const entry = CURRICULUM[idx]
  const prompt = buildPrompt(entry, st)

  if (dryRun) return { fired: false, reason: 'dry-run', prompt, entry, nextIndex: (idx + 1) % CURRICULUM.length }

  st.lastFiredAt = Date.now()
  writeState(st) // 先记 firing，防同分钟重复；真正发布成功再写 lastPostedDate
  try {
    await deliver(ctx.sessionController, cfg.sessionId, WORK_DIR, prompt)
    const ns = readState()
    ns.lastPostedDate = todayStr(now)
    ns.nextIndex = (idx + 1) % CURRICULUM.length
    ns.postedCount = (ns.postedCount || 0) + 1
    writeState(ns)
    console.log(`[qzone-daily] 已投递日更：第 ${ns.postedCount} 天 · ${entry.country} · ${entry.era}`)
    return { fired: true, entry }
  } catch (e) {
    console.log('[qzone-daily] 投递失败，下轮重试：' + e.message)
    return { fired: false, reason: 'error:' + e.message }
  }
}

/** 启动日更调度（在插件 apply 里调用，复用注入的 ctx） */
export function startQzoneDaily(ctx) {
  const cfg = readConfig()
  if (!cfg.enabled) {
    console.log('[qzone-daily] 已禁用（见 ' + CFG_FILE + '）')
    return
  }
  if (!cfg.sessionId || cfg.sessionId.includes('YOUR_CHAR_ID')) {
    console.warn('[qzone-daily] 未配置 sessionId：请在 ' + CFG_FILE + ' 设置你 agent 的真实会话 id（形如 bili-whale-char-xxxxxxxx），否则无法投递。')
    return
  }
  fs.mkdirSync(WORK_DIR, { recursive: true })
  setInterval(() => {
    tickQzoneDaily(ctx, { now: new Date() }).catch((e) => console.log('[qzone-daily] tick 失败：' + e.message))
  }, 60_000)
  console.log(
    `[qzone-daily] QQ空间日更调度已启动（每 60s tick；会话 ${cfg.sessionId}；默认 ${String(cfg.hour).padStart(2, '0')}:${String(cfg.minute).padStart(2, '0')}）`
  )
}
