# CCPC Rank · 历史榜单实验室

静态、浏览器本地运行的 CCPC 动态榜单工具。新规则依据 2026 CCPC Online Contest N 题题面：单题通过数达到 50 或全体队伍的 20%，或比赛进入第 240 分钟，公开该题。该题面注明规则当时尚未最终定稿。

## 运行

无需安装依赖，Node.js 18+：

```powershell
git clone https://github.com/serikaonoe123/ccpc-rank.git
cd ccpc-rank
npm run dev
```

访问 http://127.0.0.1:4173 。测试：`npm test`。

`dist/` 内为完整静态站点，可部署到 GitHub Pages 或其他静态托管服务。`server.mjs` 只用于本地预览；`.openai/hosting.json` 为现有 Sites 站点的部署配置，本地运行和其他静态托管服务不需要此文件。

## 功能

- JSON 与提交 CSV 导入，逐条回放，时间线和倍速。
- 最终榜单 CSV、TSV、标准 HTML 导入为快照，不推测缺失的历史。
- 50 队 / 20% / 240 分钟 OR 判断，可配置。
- 公开前整列统一隐藏，不显示单元格状态和题目统计；队伍总分持续更新。
- 第 240 分钟起题目全公开，240 分钟（含）后提交进入常规封榜；最终榜单按钮揭开赛末前全部成绩。
- 队伍榜、学校榜、搜索、打星队伍、并列排名、当前视图 CSV 导出、原始 JSON 备份。
- 文件在浏览器解析，不上传；历史赛事存储于 localStorage，存在浏览器配额限制。

## 数据格式

```json
{
  "title": "历史比赛",
  "duration": 300,
  "problems": ["A", "B"],
  "teams": [{"id": "1", "name": "队伍", "school": "学校", "unofficial": false}],
  "submissions": [
    {"teamId": "1", "problemId": "A", "time": 10, "verdict": "WA"},
    {"teamId": "1", "problemId": "A", "time": 25, "verdict": "AC"}
  ]
}
```

time 单位为开赛后的分钟，可使用小数；计分时首次 AC 分钟向下取整。时间达到 duration 的提交不计分。CE 不计罚时。包含 submissions 字段表示提交级数据（包括空数组）；没有此字段表示最终快照，队伍通过 `results: {"A": {"solved": true, "time": 25, "wrong": 1}}` 提供各题记录。

CSV 最终榜表头示例：`name,school,A,B`，单元格例：`+1 00:25`、`+ 25`、`-2`、空白。UTF-8 CSV 可由 Excel 另存；不直接支持 xlsx。提交 CSV 表头：`teamId,name,school,problemId,time,verdict`。

HTML 支持静态表格，表头含 Who / Team / Name / 队名 / 队伍 和单字母题目列。复杂合并表头、图片、动态网页壳需要转为标准格式。

本工具是本地分析工具，隐藏只影响显示，浏览器中仍持有原始文件。若用于正式公共比赛，应增加后端访问控制并由服务器过滤隐藏数据。演示赛全部为模拟数据，非真实历史成绩。

默认打星队伍计入揭榜阈值分母与通过数，但不占正式队伍排名；学校榜只取正式队伍最高成绩。所有队伍均不因零提交而过滤。不存在多端同步和多人协作功能。

规则来源：https://codeforces.com/gym/106725/problem/N
