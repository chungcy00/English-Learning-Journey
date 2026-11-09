# Gemini 三 Key 配置

项目不再设置用户/IP/全站每日调用次数，也不依赖 Redis。现有主 Key 保留，另支持两个服务端 Key：

| 服务端环境变量 | 用途 |
| --- | --- |
| `GEMINI_API_KEY` | 原有第一把 Key |
| `GEMINI_API_KEY_2` | 新增第二把 Key |
| `GEMINI_API_KEY_3` | 新增第三把 Key |

Key 在 Vercel Production／Preview 以 Sensitive Secret 保存。不得添加 `VITE_` 前缀，不提交密钥到 Git，也不在日志、健康检查或错误响应中返回值。

本地可在已被 `.gitignore` 排除的 `.env.gemini.local` 中填写第二、第三把 Key；开发服务器启动时读取此文件。使用 `.env` 的 `LOCAL_AI_API_ORIGIN` 时，本地请求继续通过部署后的服务端 Key 池。修改本地文件后，若使用本机直连模式，需要重启开发服务器；线上变量变更需要新部署。

## 行为

- 配置值去重，服务实例内依次轮换；无需账户或 IP 身份计数。
- 供应商返回 429、401、403 时，暂时跳过受影响的 Key，使用其他可用 Key。尊重供应商冷却时间；所有 Key 都不可用时返回真实供应商／配置错误。
- 正常成功只调用一次。SDK 隐式重试关闭，每个操作共用有限尝试次数和超时；缓存、输入边界与返回结构校验保留。
- `/api/health` 仅返回是否配置及 Key 数量，不返回内容。
- Google 的请求配额按项目计算，不按 Key 单独计算；同项目增加 Key 不会独立增加项目额度。[Google 官方说明](https://ai.google.dev/gemini-api/docs/rate-limits)
- 新版授权 Key 同样受支持，不根据旧版 Key 前缀误判。[Google Key 文档](https://ai.google.dev/gemini-api/docs/api-key)
