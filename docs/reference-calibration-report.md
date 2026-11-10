# 全站角色与叶子位置校准

依据用户原始九张 UI 示意图，以及最新版正式透明素材，复核了角色的可见轮廓、相邻标题间距、卡片贴边点和叶子的伸展方向。保留字体、配色、文案、学习业务与原始插画像素；不以更改页面文字大小来迁就插画。

## 各区域结果

| 区域 | 校准内容 |
|---|---|
| 全站 Logo | 保留共读图案原比例和现有位置，检查无遮挡 |
| 页眉叶子 | 朝左下伸展，匹配右上角示意方向 |
| 首页继续阅读 | 猫猫贴右上边线；左下叶子朝左上伸展 |
| 创作灵感 | 桌面仓鼠适度增大，爪子贴主题栏上沿；手机保留紧凑尺寸 |
| 自定义主题 / 导入英文稿 | 两种模式均显示右上向外伸展的叶子，不再切换后消失 |
| 阅读文章 / 精选词汇 | 专用猫猫和仓鼠按各自面板左上角校准偏移，保留爪子压线和发音/收藏操作区域 |
| 自定义词条 / 空状态 | 保留猫猫在输入框右上沿，检查思考/看书状态居中且无文字遮挡 |
| 复习入口 | 左卷尾猫猫增大，放在入口左上沿，保留右侧短线 |
| 复习词卡 | 仓鼠按示意适度增大并调整靠右位置，保留发音按钮空间和整卡翻面 |
| 个人生词本 | 看书猫猫增大并提高，书本仍在标题区；标题叶子避让文字；A–Z 仓鼠落在外框右下缘 |
| 历史统计 | 闭眼小猫按面板宽度缩放，爪子仍压住右上边线 |
| 历史短文 | 使用最新捧书仓鼠；横向随标题宽度定位，纵向以第一张卡片上沿为准 |
| 词汇复习任务 | 仓鼠调整大小与偏移，使书本位于上沿内侧且不碰上方统计区域 |
| 词汇六栏 | 不改导航与内容；复核空状态与角色显示 |
| 页脚 | 复核两侧叶子朝向；手机和平板底部导航模式继续隐藏版权页脚 |

## 历史标题校准依据

标题与仓鼠之间的可见间距参考原图约为标题宽度的 0.45 倍，新增 `ResizeObserver` 只测标题实际宽度。替代之前随整张卡片宽度变化的百分比偏移。四种视口实测间距比例为 0.455–0.460，书本底部距卡片外缘约 2px（含边框），窄至 320px 时适度缩小角色以避让「管理」。

## 实际修改文件

- `src/handDrawn.css`：角色大小、贴边偏移、叶子方向及窄屏适配。
- `src/views/HomeView.tsx`：导入表单补齐同款叶子。
- `src/views/ReadingHistoryView.tsx`：只测量标题宽度，设置角色定位用 CSS 变量。
- `DESIGN.md`：记录校准后的定位规则。
- 本报告及 `docs/screenshots/reference-calibration/` 截图。

## 检查

- TypeScript、生产构建通过，277 项现有测试通过。
- 独立 Chromium 使用合成数据，1440 / 820 / 375 / 320px 全页面检查，无横向溢出。
- 额外检查导入/自定义切换、叶子方向、空搜索角色、整卡翻面与六栏详情；没有页面脚本错误。
- 静态资源、加载动画、接口、AI 提示词、数据库与收藏/复习记录未修改。
- 没有实体手机或 Safari 的实测证据；本轮响应式验证来自 Chromium。

## 当前实际截图

![home-1440](screenshots/reference-calibration/home-1440.png)

![home-375](screenshots/reference-calibration/home-375.png)

![import-1440](screenshots/reference-calibration/import-1440.png)

![import-375](screenshots/reference-calibration/import-375.png)

![reading-1440](screenshots/reference-calibration/reading-1440.png)

![reading-375](screenshots/reference-calibration/reading-375.png)

![review-1440](screenshots/reference-calibration/review-1440.png)

![review-375](screenshots/reference-calibration/review-375.png)

![wordbook-1440](screenshots/reference-calibration/wordbook-1440.png)

![wordbook-375](screenshots/reference-calibration/wordbook-375.png)

![history-1440](screenshots/reference-calibration/history-1440.png)

![history-820](screenshots/reference-calibration/history-820.png)

![history-heading-1440](screenshots/reference-calibration/history-heading-1440.png)

![history-heading-375](screenshots/reference-calibration/history-heading-375.png)

![tasks-1440](screenshots/reference-calibration/tasks-1440.png)

![custom-375](screenshots/reference-calibration/custom-375.png)

![custom-empty-375](screenshots/reference-calibration/custom-empty-375.png)

![detail-375](screenshots/reference-calibration/detail-375.png)
