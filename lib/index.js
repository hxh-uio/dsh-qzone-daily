// dsh-qzone-daily · QQ空间科普日更插件（独立版，可单独作为 DSH bundle 启用）
// 逻辑与 dsh-bili-whale 内嵌版一致；此文件仅提供标准 DSH 插件入口。
import { startQzoneDaily } from './qzone-daily.js'

export default {
  name: 'dsh-qzone-daily',
  inject: ['sessionController'],
  apply(ctx) {
    try {
      startQzoneDaily(ctx)
    } catch (e) {
      try { console.warn('[qzone-daily] 启动失败：' + e.message) } catch {}
    }
  },
}
