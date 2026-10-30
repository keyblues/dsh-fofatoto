# dsh-fofatoto

**fofatoto（FOFA 网络空间测绘）的 DeepSeek Harness 插件**：把 [fofatoto](https://github.com/keyblues/fofatoto) 里真正值钱的 FOFA 查询语义搬进 DSH，让 Agent 直接调用工具，而不是拼 shell 调 exe。

- 包名：`dsh-fofatoto`（Host + Web Client 双半）
- 工具：`fofa_account`、`fofa_search`、`fofa_export`（三个）
- 插件页配置卡片：粘贴 API Key，写入 Harness 凭据库，不回显
- 对话卡片：三个工具各有默认收起的卡片（账号状态 / 命中数 + 语句 / 导出文件 + 统计）

## 安装（DSH Desktop）

DSH Desktop 支持**直接输入仓库地址安装**：

1. 打开侧边栏「插件」页；
2. 点右上角「添加插件」→「安装第三方插件」；
3. 在「包名或地址」里输入本仓库地址：

   ```text
   https://github.com/keyblues/dsh-fofatoto
   ```

4. 安装完成后进入本插件详情页，在配置卡片里粘贴 FOFA API Key（写入 Harness 凭据库，不落配置文件）；
5. 工具随插件自动注册：`fofa_account` / `fofa_search` / `fofa_export`。

要求：Node.js ≥ 20（DSH 内置即可）、DSH `>=0.2.1-rc.3 <0.3.0-0`。
开发时可填本地目录绝对路径（DSH 会以 `link:` 方式安装），改完代码重载 bundle 即可生效。

> 更新插件后需要重启 DSH：运行中的进程不会重新加载已修改的 Host 模块。

---

## 从 fofatoto 移植了什么

| 已移植（JS 原生实现，无 Python 依赖） | 说明 |
|---|---|
| `FofaClient.search` 语义 | `qbase64` 编码、fields 归一、自定义 `url` 字段剥离、域名推断、错误分类与重试退避 |
| `search_all_efficient` | `before="时间"` 游标深翻页（可破 1 万条）、按 host 去重、批次限速、`fill` 比例 |
| 额度查询与中转站识别 | 内置 `RELAY_INFO_APIS` 域后缀匹配 + 官方兜底（与 fofatoto 一致，不引入额外配置）；响应字段做多别名归一 |
| 导出器 | CSV（UTF-8 BOM，Excel 友好）、JSON、TXT（URL/IP/域名列表）、去重字段合并 |
| 字段全集 / `build_url` / 时间游标 | 逐条对齐，含 `http,https` 这类脏 protocol 的处理 |

| 未移植（刻意） | 原因 |
|---|---|
| 本地 Web UI、web_auth、登录限流 | DSH 已有 Web UI，本插件用插件页卡片代替 |
| CLI / argparse / banner / 进度条 / 配色 | 无终端界面需求 |
| GitHub 更新检查、自动升级 | 由 DSH 的 plugin manager 负责 |
| 批量文件模式（`-b`/`-p`） | Agent 自己就能循环调用 `fofa_export`，或合并 `||` 语句省额度 |
| favicon / icon_hash 查询（`--icon`） | 抓图标、算 murmur3、SSRF 防护是纯冗余：模型用 shell 调 `fofatoto --icon` 或 `favicon_hash()` 出 hash，再把 `icon_hash="..."` 交给 `fofa_search` 即可 |

> 移植代码与 fofatoto 同源（GPL-3.0），故本插件沿用 GPL-3.0-or-later。

## 工具

### `fofa_account` — 查额度（不耗额度）

无参数。返回账户类型（官方/中转站）、Key 是否有效、今日剩余、剩余查询、到期时间、首次使用、Key 来源。**测绘前先调它**，和 `fofatoto -c` 等价。

### `fofa_search` — 单页检索（1 次额度/调用）

| 参数 | 说明 |
|---|---|
| `query` | 必填。FOFA 语句，如 `domain="a.com" && port="443"` |
| `size` | 返回条数 1–10000，默认 50 |
| `page` | 页码，默认 1（深翻页不稳定，全量请用 export） |
| `fields` | 逗号分隔字段，默认 `host,ip,port,protocol,domain,title`（默认不含 `server`，需要时显式加）；支持本地拼接的 `url` |
| `full` | 是否 full 数据（含一年前），默认 false |

返回：匹配总数、本页行（对象数组）、IP 去重数；模型侧输出为紧凑 JSON（见下）。

### 输出格式（模型侧：一行摘要 + 紧凑 JSON；Web 侧：专用卡片）

三个工具的 `output.render` 都返回 **「一行中文摘要 + 紧凑 JSON」**：

- 摘要行让模型最快定位结果（账号状态／命中数／导出结论），JSON 与 `output.schema` 一一对应，机器可直接解析，PTC 模式拿到的也是同一个规范值；
- 官方 `plugin_manager` 等数据型工具同样返回紧凑 JSON，这里只是在前面加了一行不参与解析的摘要；
- `output.schema` 声明了全部字段（`additionalProperties: false`），`nextBefore` 是 `string | null`（`null` = 没有剩余数据，可直接 `appendTo` 续拉）。

样例（摘要行 + 省略的 JSON 体）：

- `fofa_account`：`中转站 · Key 有效 · 今日剩余 91 · 剩余查询 不限 · 到期 2026-12-01`
- `fofa_search`：`命中 67 条 · 本页 2 条 · 去重 IP 1`
- `fofa_export`：`导出完成 · csv · 2 行 → C:\...\fofa-output\fofa_results_20261030_153000.csv`
- `fofa_export` 未拉完：`导出未完成（time-budget） · csv · 10000 行 · 总匹配 25000 → …（可 appendTo 续拉）`

Web 端在 `tool.call.toolview` keyed slot 里注册了三张专用卡片（不再走 generic 行）：**默认收起**，
收起时只显示一行头部摘要，点击展开；头部摘要：

- 检索：`命中 78717 条 · domain="baidu.com"`（命中数 + 查询语句）；
- 导出：`csv · 1000 行 · domain="baidu.com"`（格式 + 行数 + 查询语句）；
- 账号：`中转站 · 有效 · 今日剩余 94`（账户状态）。

展开后每张卡片都先显示**查询配置块**：

- 检索卡片：`语句`、`条数`、`页码`、`字段`，下面是本页最多 8 行结果表（host/ip/port/title）；
- 导出卡片：`语句`、`条数上限`（0 = 全部，缺省 = 默认 1000，带 `fill`/`full` 时一并显示）、`字段`、`格式`、`去重字段`，下面是文件路径（可点击打开）与行数/总匹配/接口调用/耗时/停止原因/游标；
- 账号卡片：账户类型、Key 状态、今日剩余、剩余查询、到期、首次使用、VIP 等级、接口地址。

查询配置来自调用参数（未在 `output` 里重复保存），旧会话日志里的纯 JSON 结果仍能正常回放。

结果过大时（例如 `fofa_search size=1000`）Harness 会把模型可见内容 spill 落盘，模型只看到预览 + 路径；
三个工具的 `output.presentationMeta` 另外持久化了一份**有界的卡片事实**（检索为 `rowCount` + 最多 8 行预览，
导出为文件/统计/游标），所以卡片在这种情况下仍能正常显示配置、条数和预览表，并提示「结果过大已落盘」。

### `fofa_export` — 全量落盘（按批次数耗额度，增量写盘）

| 参数 | 说明 |
|---|---|
| `query` | 必填。多目标可用 `\|\|` 合并：`domain="a.com" \|\| domain="b.com" \|\| ip="1.2.3.4"`。续拉时可省略（沿用元数据） |
| `limit` | 最多拉取条数，默认 1000；`0` 表示按总数（受 `maxExportRows` 保护）；续拉时表示本次新增条数 |
| `format` | `csv`（默认）/`json`/`txt` |
| `fields` | 同上，`url` 会自动拼好 |
| `dedup` | 去重字段，默认按导出字段；常用 `url`、`ip`、`ip,host`、`domain` |
| `fill` | 拉取比例 (0,1]，默认 1；总量极大时用 0.8 省额度 |
| `fileName` | 输出文件名（不含目录），缺省 `fofa_results_<时间戳>` |
| `appendTo` | **断点续拉**：传上次返回的 `path`，从保存的游标继续追加到同一文件（JSON 不支持） |
| `full` | 是否 full 数据 |

行为：先 `size=1` 查总数 → 按 `before="时间"` 游标分页（每批 ≤1 万，批间隔默认 5s）→ 按 host 去重 → 写入 **`<会话工作区>/fofa-output/`**（可配 `outputDir`），重名自动 `_1`、`_2`。每批结果**写完即 `fsync`**，文件旁边还有 `<文件>.meta.json` 侧车记录格式/字段/游标，供续拉使用。

## 超时与数据安全

导出可能跑很久（深翻页、代理慢、中转站限流都会拖时间），所以做了三层保护：

1. **每批立即落盘并 fsync**：不是"全部拉完再写文件"。第 1 批写完哪怕第 2 批卡死，前 1 批也已经在磁盘上。
2. **自己的时间预算**（`maxExportSeconds`，默认 240s）：到点在批次之间主动收尾，返回 `partial: true`、`stoppedReason: "time-budget"`，并给出 `nextBefore` 游标——**已经拉到的行完整保留**。工具超时被设为 `maxExportSeconds + 60`，正常情况下预算先生效，不会撞上 DSH 的 `TOOL_TIMEOUT`。
3. **断点续拉**：`fofa_export appendTo="<上次的 path>" limit=<条数>` 从 meta 里的游标继续，追加到同一文件（不重复写表头），且**跳过总数查询**（省 1 次额度），已拉过的行不会重复消耗。

其他行为：

- 中途 HTTP 失败但已有数据 → 不抛错，返回 `partial: true`、`stoppedReason: "upstream-error"` + 已落盘文件路径。
- 用户取消 / 进程重启：文件里是最后一个完整批次，最多丢正在写的那一批（批内一次写入，不会半行）。
- 成功但零结果 → 保留空文件与 meta（`stoppedReason: "empty"`）；**硬失败且一行未写** → 删除空文件，直接报错。
- 列顺序固定为「请求字段 + 去重字段」，JSON 用 `[]` 闭合、CSV 带 UTF-8 BOM、TXT 按 `ip`/`domain`/`url` 自动选模式。
- `nextBefore` 为 FOFA 时间游标（`YYYY-MM-DD HH:MM:SS`），按 `-1s` 步进，与 fofatoto 一致。

## 本地开发与验证

```powershell
node --check index.js
node --check client.js
node --test test/            # 单元测试；3 个 live 用例需 FOFA_TEST_KEY，默认 skip
```

在 DSH 里用 `plugin_manager install_bundle` 指向本目录可做 link 安装（开发调试用）。

## 配置

配置项都在 `cordis.patch.yml` 的 `config` 里，全部可选：

| 键 | 默认 | 说明 |
|---|---|---|
| `baseUrl` | `https://fafaapi.info` | **接口地址**。默认按中转站配置；官方账号改 `https://fofa.info`；也可在插件页卡片直接改（持久化到本 profile 的 `cordis.patch.yml`，热重载生效） |
| `credentialRef` | `FOFA_API_KEY` | 凭据库引用名 |
| `apiKeyEnv` | `FOFA_KEY` | 环境变量名 |
| `apiKey` | 空 | 直接写 Key（优先级最高，不推荐） |
| `timeoutMs` | 45000 | 单次 HTTP 超时 |
| `retries` | 2 | 单次请求重试次数 1–4 |
| `defaultFields` | `host,ip,port,protocol,domain,title` | 默认字段（不含 `server`） |
| `outputDir` | 空 | 空 = `<工作区>/fofa-output` |
| `maxExportRows` | 50000 | 单次导出条数上限 |
| `maxExportSeconds` | 240 | 单次导出时间预算（秒，5–540）；到点主动收尾，数据已落盘 |
| `rateLimitSeconds` | 5 | 深翻页批次间隔 |
| `fofatotoConfigPath` | 空 | 指向本机 fofatoto 的 `config.json`，未配置 Key 时复用其中 `key` |

**Key 解析顺序**：`config.apiKey` → 凭据库 `FOFA_API_KEY` → 环境变量 `FOFA_KEY` → `fofatotoConfigPath` 的 `config.json`。

**推荐**：在「插件」页打开 FOFATOTO 详情，粘贴 Key 保存（写入 Harness 凭据库，不落 profile 配置、不回显，卡片只显示尾号）。

## 接口地址与账号信息接口（按 fofatoto 规则）

**接口地址 `baseUrl` 可配置**：既决定搜索接口（`/api/v1/search/all`），也决定账号接口的基址。可在插件页卡片里直接改（保存走 Host `configEditor`：原子写本 profile 的 `cordis.patch.yml` + Loader 热重载），也可以写 YAML。

**账号信息接口不参与配置**，与 fofatoto 一致：代码里内置 `RELAY_INFO_APIS` 表，按域名后缀匹配（`host === domain || host.endsWith('.' + domain)`，先命中先用）：

| baseUrl | 检测结果 |
|---|---|
| `https://fafaapi.info`（或任意 `*.fafaapi.info`） | 中转站：`{base_url}/fofaapi/v1/validate-key?key={key}` |
| 其他（`https://fofa.info` 等） | 官方：`{base_url}/api/v1/info/my?key={key}` |

要接入新的中转站，按 fofatoto 的方式改代码里这一张表即可（`index.js` 的 `RELAY_INFO_APIS`），不新增配置项。响应字段按 fofatoto 的归一化口径读取（`valid`/`isvip`、`todayRemaining`、`totalRemaining`/`remain_api_query`、`expireTime`/`expiration`、`firstUsedAt`），部分中转站把字段包在 `data` 里也能读。

「测试连接」支持用**未保存的接口地址**试通再存；`configEditor` 不可用的环境里接口地址输入会置灰并提示改 YAML（Key 仍可单独保存）。

切换官方账号：在本 profile 的 `cordis.patch.yml` 追加

```yaml
- id: dsh-fofatoto
  config:
    baseUrl: https://fofa.info
```

## 与资产收集流程对接

对应 `asset-collection` skill 第②阶段：

```text
fofa_account                        看今日剩余，规划查询数
  → fofa_search domain="…"          看总量/样本，验证语句
  → fofa_export                     落盘 CSV（--full --dedup url 等价参数都在）
  → fofa_icon 的位置改为：fofatoto --icon <url> → icon_hash="…" → fofa_search
```

老命令对照：

```text
fofatoto.exe -c
  → fofa_account
fofatoto.exe 'domain="a.com"' -l 10000 -csv -f url --dedup url --full -o out.csv
  → fofa_export query='domain="a.com"' limit=10000 format=csv fields=url dedup=url full=true
```

## 安全与边界

- API Key 只存在本机（凭据库/环境变量/你的 fofatoto 配置），不写日志、不回显、不随工具结果返回。
- 插件路由与插件页同源，且要求自定义请求头，跨站页面无法静默改写 Key。
- 导出文件落在会话工作区内，文件名做了目录穿越过滤。
- 额度保护：`maxExportRows` 上限 + `fofa_account` 前置检查；`fofa_export` 并发不安全（同时多次导出会互相抢额度）。

## 许可

GPL-3.0-or-later。查询语义移植自同样以 GPL-3.0 发布的 [fofatoto](https://github.com/keyblues/fofatoto)（同一作者）。
