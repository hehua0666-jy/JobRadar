# JobRadar v1.2

面向秋招的个人岗位情报与投递管理工具，支持直接部署到 GitHub Pages。

## 核心功能

- 收录 2027 届正式秋招 / 提前批 / 校园招聘正式岗位
- 同步关注 2026 届未就业可投正式岗位
- 严格排除实习岗位
- 私企 / 央国企事业单位 / 外企分类
- 北京 / 上海 / 杭州 / 深圳城市筛选
- AI、语音、音频、声学、信号处理、汽车智驾、研究院等方向筛选
- 卡片模式 / 列表模式切换
- “已投递”本地标记与已投递公司汇总
- 主列表与观察名单分离
- 证据等级：A / B / C
- 具体岗位与项目级入口区分
- 本周新增、临近截止、未投递等工作流筛选
- 新秋招公司雷达：承接新发现的公司级招聘事件并跟踪核验状态

## 文件结构

- `index.html`：主页面
- `style.css`：样式
- `app.js`：页面交互与筛选
- `jobs.json`：岗位数据库
- `company_watch.json`：长期关注但尚未确认新招聘事件的公司
- `recruitment_leads.json`：已发现的公司级秋招 / 提前批 / 校招事件
- `tools/validate_recruitment_leads.py`：招聘线索数据校验
- `scan_meta.json`：扫描与更新元数据
- `README.md`：说明文档

## 证据等级

- **A级**：企业官网具体正式岗位已核验
- **B级**：具体岗位存在，但当前开放状态等仍需复核
- **C级**：招聘项目、公司池或重点监控入口

## 招聘情报流程

```text
搜索发现 → recruitment_leads.json → 官网核验 / 岗位拆分 → jobs.json
```

- `company_watch.json` 保存长期监控对象，不表示已经发现新的招聘事件。
- `recruitment_leads.json` 保存人工或 ChatGPT 已发现的具体招聘事件及核验进度。
- `jobs.json` 只保存经过核验后真正值得投递的岗位。

未经核验的招聘线索不得自动写入 `jobs.json`。当前流程不执行自动联网搜索或企业官网抓取。

## 本地预览

由于网页通过 `fetch()` 读取 JSON 数据，请不要直接双击 `index.html`。

在项目目录运行：

```bash
python -m http.server 8000
```

浏览器访问：

```text
http://localhost:8000
```

## GitHub Pages 部署

1. 新建 GitHub 仓库，例如 `jobradar`
2. 将本项目所有文件上传到仓库根目录
3. 打开 `Settings → Pages`
4. Source 选择 `Deploy from a branch`
5. Branch 选择 `main`，目录选择 `/root`
6. 保存，等待 GitHub 生成 Pages 地址

之后更新 `jobs.json` 或其他文件即可，网站地址无需变化。

## 隐私说明

当前“已投递”状态保存在浏览器 `localStorage` 中：
- 其他访客看不到你的投递状态
- 其他访客的操作不会影响你
- 但不同设备之间暂时不会自动同步

## 使用声明

本项目仅用于个人求职信息整理与导航。招聘信息来自企业公开招聘渠道，岗位详情、资格要求、截止时间和实际开放状态均以企业官方招聘网站为准。

## v1.1 岗位变化检测
- 新增 `changes.json`：记录新增 / 更新 / 下架
- 新增 `data/jobs_previous.json`：保存上一版数据库快照
- 新增 `tools/diff_jobs.py`：比较新旧岗位数据库
- 新增 GitHub Actions：`jobs.json` 更新后自动生成变化记录
- 网页顶部新增“岗位变化雷达”

注意：该流程负责比较与展示变化，不负责自动抓取全部企业官网；后续需要继续为不同招聘系统增加采集/核验逻辑。

## v1.2 新秋招公司发现与核验

- 新增独立的 `recruitment_leads.json` 公司级招聘事件池。
- 新增紧凑的“新秋招公司雷达”、内部状态筛选与优先级排序。
- 新增 `tools/validate_recruitment_leads.py`，用于结构、枚举、URL 和重复线索校验。
