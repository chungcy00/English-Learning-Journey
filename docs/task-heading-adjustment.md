# 词汇复习任务标题与边框调整

- 「词汇复习任务」标题移到内容框外，与「历史短文」同样作为独立栏目标题。
- 外层语义 section 不设边框；原有内容、按钮与分级列表移入 `history-task-panel`，保留手绘外框。
- 现有仓鼠锚定下方内容卡片的右上沿，提高到 top:4px，保留原图、比例和左上三条短线。
- 选中等级后的详情标题、焦点与操作保持原样。

修改文件：`src/components/HistoryVocabularyTasks.tsx`、`src/handDrawn.css`、`DESIGN.md` 及本报告/截图。

检查：TypeScript、生产构建及 277 项现有测试通过。独立 Chromium 在 1440 / 820 / 375 / 320px 检查标题位于框外（外层边框 0px，内容卡片边框 1px），仓鼠书本压入边线约 8px，页面没有横向溢出。分级详情、标题焦点、返回总览与「复习全部」入口通过，没有页面脚本错误。未更改数据或 AI 接口。

![桌面实际效果](screenshots/task-heading/tasks-1440.png)

![手机实际效果](screenshots/task-heading/tasks-375.png)
