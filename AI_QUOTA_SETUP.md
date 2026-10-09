# AI 额度保护部署说明

代码已实现跨实例统一额度检查；**没有连接共享 Redis 时，AI 接口返回 503 并停止调用模型**。2026-09-27 已完成 Vercel 生产部署和真实 Redis 扣记联调，见文末记录。

## 免费配置

1. 在 Upstash 创建 **Free** Redis 数据库并连接当前 Vercel 项目。选择免费计划，不启用自动付费升级。套餐以 [官方价格页](https://upstash.com/pricing/redis) 为准。
   - 已于 2026-09-27 创建 `English-learning`（Free，N. Virginia，Eviction 关闭），并将 Redis URL/token、随机 salt 与下表五项额度作为 Secret 保存到当前 Vercel 项目的 Production / Preview；生产联调已通过，未开通付费计划。
2. 在 Vercel 项目服务端环境变量设置 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`；也兼容 `KV_REST_API_URL`、`KV_REST_API_TOKEN`。使用可写 token，不是只读 token。不要发到聊天，不要加 `VITE_` 前缀，不要提交 `.env`。
3. 生成一个至少 32 字符的随机密钥作为 `AI_RATE_LIMIT_SALT`。例如在自己终端运行 `openssl rand -hex 32`，把结果仅存入环境变量。所有生产实例使用相同的数据库、salt 和限额设置。salt 要保持稳定，随意更换会重置 IP 身份。
4. 配置下表变量，重新部署。先在预览环境验证；预览如使用同一数据库，会与生产共享额度。不要删除生产计数器或变更存储前缀来恢复额度。

| 变量 | 默认值 | 范围 |
| --- | ---: | --- |
| `AI_GLOBAL_DAILY_LIMIT` | 100 | 全站所有 AI 请求合计，每天 |
| `AI_IP_MINUTE_LIMIT` | 5 | 每个公网 IP，每分钟 |
| `AI_IP_DAILY_LIMIT` | 30 | 每个公网 IP，每天 |
| `AI_SPEECH_GLOBAL_DAILY_LIMIT` | 10 | 全站云端语音子额度，每天 |
| `AI_SPEECH_IP_DAILY_LIMIT` | 3 | 每个公网 IP 云端语音子额度，每天 |

变量只能为非负整数；`0` 表示暂停，不是无限。省略变量使用默认值。日窗口按 Redis 时间在 UTC 00:00（马来西亚 08:00）重置，分钟窗口按整分钟重置。临界时间前后可以分别使用两个窗口的额度，这不是滑动窗口。

## 计数含义与故障处理

- 一次**实际模型调用尝试**扣 1 次：生成、改写、翻译、词条查询、评分、语音共用全站额度，语音同时扣子额度。
- 自动重试、换模型、词汇不合格后的纠正生成也扣额度。SDK 隐式重试已禁用；失败、超时、断开不会退款，避免不确定状态重复消耗。一次点击可能包含生成与翻译两次或更多调用。
- 通过 Redis REST 的单条 Lua 脚本原子检查并预扣，跨路由、实例和区域共用计数；不使用实例内存作为全站限流依据。
- 超限返回 `429`、中文提示及 `Retry-After`。Redis 未配置、超时、免费用量耗尽或异常时返回 `503`，**不放行模型请求**。缓存语音、设备朗读、历史记录、本地 PDF 不扣 AI 额度。
- 所有 Google AI 调用必须经过 `consumeAiQuota`；新增接口时也要遵守。文本输出已设每次最多 8192 tokens，输入和语音长度也有限制。

## IP 与剩余风险

- Vercel 环境只使用平台覆盖的 IP 请求头；其他主机只信任 socket 地址，不能直接照搬任意代理头。[Vercel 请求头说明](https://vercel.com/docs/headers/request-headers)
- IPv4 映射地址统一处理；IPv6 同一 /64 共用额度，避免隐私地址轮换轻易绕过。仅将 HMAC 后的 IP 标识存入计数 key，不存明文 IP。
- 同一 Wi-Fi/公司网络通常共享公网 IP，会共用额度。VPN、移动网络换 IP 仍能改变 IP 身份，但全站总上限不会因此增加。
- 这不是账户鉴权，也不能保证额度公平：恶意用户仍可能抢完全站额度。强保护还需登录、验证码或边缘防火墙。
- 本保护限制的是模型尝试次数，不是精确 token/金额，也不保证这些默认数值小于供应商免费额度。请保持供应商免费配置并按模型实际免费配额调低上限。任何其他项目/旧部署使用同一 API key 的调用不受本代码控制；发布后应停用无保护的旧部署或撤销其旧 key。
- 大量被拒绝的请求仍会占用 Vercel/Redis 服务资源。坚持免费套餐可避免主动购买用量，但不能保证网站不会因免费服务额度耗尽而暂停。

## 验证

- `node --import tsx --test backend/*.test.ts src/utils/*.test.ts`
- 测试环境将全站上限设为 `0`，所有 AI 路由应返回 429 且无供应商请求；移除 Redis token 应返回 503。
- 核对 Vercel 环境变量及实际预览/生产响应后才能宣称线上限额生效。不要为测试清空生产计数。

### 2026-09-27 生产联调记录

- V2.3.8 应用提交 `38b4159` 的 Vercel 部署 `CBk49DujMtLAfEQyV3Z5LwtvEWUW` 显示 Ready，已关联正式域名 `english-learning-journey-two.vercel.app`。
- 在正式站搜索并添加 `break the ice`：返回真实释义、例句和 `idiom` 类型，今日复习从 13 项增加至 14 项，进入复习页后首卡为该习语。
- 通过 Upstash CLI 只读 `HGETALL mine-english:{ai-quota}:v1:global:day`：调用前无记录，调用后 `count=1`，确认请求经过共享 Redis 预扣。未清空计数，未耗尽生产额度进行压力测试。
- 上限拒绝、并发原子性、各 IP 和语音子额度由 17 项本地回归测试验证；生产仅执行上述一次真实调用，不把本地模拟测试描述为线上压力测试。
