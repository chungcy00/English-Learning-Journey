# Mine English 全站视觉改版与加载动画验收记录

日期：2026-11-10（Asia/Kuching）。

## 完成范围

| 页面或区域 | 改版结果 | 保留的行为 |
| --- | --- | --- |
| 导航与品牌 | 猫猫、仓鼠共读绿书 Logo；轻手绘导航线；统一植物点缀 | 原五个入口、计数、手机和平板底部导航与安全区域 |
| 生成首页 | 继续阅读边缘猫猫、灵感区仓鼠；统一主题卡、输入框、按钮；桌面配方横向对齐 | 继续阅读、灵感、主题分类、自定义主题、英文稿导入、等级、文体、篇幅、数量、风格、生成 |
| 当前阅读 | 正文和精选词汇采用共用纸张轮廓，角色位于外缘；播放器统一轮廓 | 标题、等级、系统语音、播放进度、段落译文、词汇弹窗、增删与收藏 |
| 自定义单词 | 输入与预览统一卡片；搜索、列表及空状态采用同一视觉体系 | 添加词条、预览、生成资料、编辑、重复检查及列表 |
| 词汇复习 | 入口、随机复习控制栏及整张翻面卡片统一轮廓；仓鼠提示 | 类别、数量、换组、上下张、整卡翻面、发音及会话恢复 |
| 单词详情 | 六栏继续使用既有手绘高亮和虚线；例句、词族树、词根图谱、词组及英释共享轮廓；空内容采用小型仓鼠提示 | 六栏内容方向、编辑、发音、独立收藏、旧资料降级读取 |
| 个人生词本 | 外层学习纸张、共用工具栏和词条列表；猫猫看书装饰 | 词汇/例句切换、搜索、添加和排序同排、复习、展开详情、收起时左滑删除及撤销 |
| 历史记录与复习任务 | 统计容器、历史卡片、综合与分级任务统一轮廓 | 真实数据圆环与计数、维度/等级筛选、历史管理、综合和分级复习入口 |

参考图的账号、每日任务和选择题仅属于方向示意，没有作为新增功能实现。角色图和最新对应页面图用于布局与身份参考；没有复制其中的固定数值或错误单词知识。现有字体、字号与设计色彩令牌保持不变。

## 公共组件及资源

- `LearningArt.tsx`：`Mascot` 共用图集；`Companion` 负责外缘摆放；`HandRule` 用于导航/页脚线；`HandOutline` 根据真实尺寸绘制固定圆角与亚像素轻起伏轮廓；`StudyEmptyState` 提供紧凑/普通空状态。
- `handDrawn.css`：统一卡片、按钮、输入框、菜单、弹窗、标签、状态与响应式规则；不对正文或图表数据几何施加扭曲。
- `learning-companions.webp`：同一张透明 16 格图集，包含每个角色的欢迎、阅读、思考、成功、提醒、休息动作、两种探头动作、共读 Logo 和叶片。约 340 KiB。
- `LoadingAnimation.tsx` 和其 CSS：按真实操作选择动画，超过 300ms 后挂载，结束/失败时同次渲染隐藏，卸载时清理计时器；没有百分比或最短展示时间。
- 生成等待提示采用非模态角落提示，保留状态、主题、取消与提示文字，不锁住导航、焦点或网页滚动。删除、编辑等原有弹窗的模式不变。

## 五组真实循环动画

所有资源均由内置 imagegen 按用户提供的角色/动作图重新制作；不是直接播放静态参考图。每张透明 WebP 包含 4×3 共 12 帧，使用 CSS 切换实际动画帧，无新增动画库。

| 动作 | 循环时长 | 使用场景 |
| --- | --- | --- |
| run | 1.2 秒 | 生成短文、首次生成词汇资料 |
| read | 2.8 秒 | 读取阅读/历史/收藏数据 |
| write | 2.6 秒 | 自定义词条预览中的分析资料、段落译文准备 |
| search | 2.6 秒 | 查询文中其他词汇或词组 |
| rest | 2.8 秒 | 保存及较短等待 |

仅在确有异步操作且超过阈值时显示；本地瞬时筛选没有虚构等待。普通反馈使用小型动画，生成提示最多一个较大实例。开启减少动态效果时，CSS 停止动画并显示第一帧。图片仅在组件实际出现时请求，不会首屏下载五组动画。

资源逐项大小和精确生成提示词见 `ui-animation-assets.json`；每张图均附来源/提示词元数据 sidecar。原始 PNG 保留在生成工具输出目录，项目交付 WebP。

## 验证结果

- `npm run lint`：通过。
- `npm run build`：通过；仍有项目原有的大包体积提示，没有增加运行依赖。
- 现有后端、数据库、工具与组件测试：277/277 通过。两处旧测试的 HTML 匹配改为识别实际箭头/正文，避免把装饰 SVG 的 path 当作内容。
- 独立浏览器检查：1440px 桌面、820px 平板、390px 手机，覆盖全部页面、六栏切换、下拉菜单、样式弹窗、普通及紧凑空状态；无横向溢出或浏览器脚本错误。
- 五组动画：确认真实图像在不同帧产生不同画面、动画在一个周期后返回首帧、200ms 时未显示、超过 300ms 显示、关闭状态立即移除、减少动态效果为静态。
- 慢请求失败场景使用本地拦截响应测试：生成动画出现，等待期间可以切换历史页，失败后动画移除、错误真实展示、原输入保留。没有调用真实 AI 消耗额度。
- 旧缓存、兼容迁移和复习状态由既有测试覆盖；浏览器还实际编辑并保存词义、收藏/取消收藏例句，确认用户来源仍为 user，复习计数/日期/间隔保持原值。
- `src/index.css`、数据库、服务端、接口服务、类型及依赖清单没有改动；设计文件的颜色和字体尺度与改版前一致。App 新增的计数状态仅用于显示既有数据读取过程。
- 已修复 Logo 下缘裁切、页脚横向溢出、长短容器轮廓失真、重复边框、菜单定位和加载提示裁切。

## 验证边界与待办

请求范围内没有待确认的功能冲突或未接入页面。响应式与动画验证在浏览器中完成；未替代真实手机的字体/系统语音与电池性能验收。现有 AI 生成规则和接口未经本次改版改变，也没有用真实模型请求重复验证。

## 实际修改及新增文件

- `.impeccable/design.json`
- `DESIGN.md`
- `PRODUCT.md`
- `docs/ui-animation-assets.json`
- `docs/ui-redesign-report.md`
- `public/illustrations/README.md`
- `public/illustrations/learning-companions.webp`
- `public/illustrations/learning-companions.webp.json`
- `public/illustrations/loading/read.webp`
- `public/illustrations/loading/read.webp.json`
- `public/illustrations/loading/rest.webp`
- `public/illustrations/loading/rest.webp.json`
- `public/illustrations/loading/run.webp`
- `public/illustrations/loading/run.webp.json`
- `public/illustrations/loading/search.webp`
- `public/illustrations/loading/search.webp.json`
- `public/illustrations/loading/write.webp`
- `public/illustrations/loading/write.webp.json`
- `src/App.tsx`
- `src/components/DefinitionCards.tsx`
- `src/components/ExampleSenseCards.tsx`
- `src/components/Footer.tsx`
- `src/components/HistoryVocabularyTasks.tsx`
- `src/components/InstalledAppBottomNav.tsx`
- `src/components/LearningArt.tsx`
- `src/components/LoadingAnimation.css`
- `src/components/LoadingAnimation.tsx`
- `src/components/Navbar.tsx`
- `src/components/PhraseUsage.tsx`
- `src/components/PracticeVocabularyCard.tsx`
- `src/components/ProcessingModal.tsx`
- `src/components/ReadingLevelPieChart.tsx`
- `src/components/ReadingVocabularyEditor.tsx`
- `src/components/SavedMaterialsView.tsx`
- `src/components/VocabularyDetailsPanel.tsx`
- `src/components/WordFormation.tsx`
- `src/components/WordbookCustomAdd.tsx`
- `src/handDrawn.css`
- `src/main.tsx`
- `src/utils/homeSettings.test.ts`
- `src/utils/processingModal.test.ts`
- `src/utils/wordFormation.test.tsx`
- `src/views/CustomWordsView.tsx`
- `src/views/HomeView.tsx`
- `src/views/PracticeHubView.tsx`
- `src/views/ReadingHistoryView.tsx`
- `src/views/ReadingView.tsx`
- `src/views/ReviewView.tsx`
- `src/views/WordbookView.tsx`
