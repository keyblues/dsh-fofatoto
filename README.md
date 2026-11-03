# dsh-fofatoto

[![npm version](https://img.shields.io/npm/v/dsh-fofatoto?style=flat-square)](https://www.npmjs.com/package/dsh-fofatoto)
[![npm downloads](https://img.shields.io/npm/dw/dsh-fofatoto?style=flat-square)](https://www.npmjs.com/package/dsh-fofatoto)
[![DSH Plugin](https://img.shields.io/badge/DSH-Plugin-4c6ef5?style=flat-square)](#)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek-Harness-5b6bff?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)](package.json)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5%2B-4D6BFE?style=flat-square)](#兼容性与安全)
[![release](https://img.shields.io/github/v/release/keyblues/dsh-fofatoto?style=flat-square)](https://github.com/keyblues/dsh-fofatoto/releases)

> **English** — FOFA cyberspace mapping for DeepSeek Harness (DSH): three native agent tools — `fofa_account` (account quota), `fofa_search` (one query page with the matching rows and total count), and `fofa_export` (time-cursor deep paging into CSV/JSON/TXT files inside the session workspace, resumable from a saved cursor). Every export batch is written and fsynced immediately, so a run that hits its time budget or an upstream error keeps what it already fetched. The API key is configured on the plugin page and stored in the Harness credential store.

fofatoto（FOFA 网络空间测绘）的 DSH 插件：把 [fofatoto](https://github.com/keyblues/fofatoto) 里的 FOFA 查询语义搬进 DSH，让 Agent 直接调用工具，而不是拼 shell 调 exe。移植代码与 fofatoto 同源（GPL-3.0），本插件沿用 GPL-3.0-or-later。

## 特性

- **三个原生 Agent 工具**：`fofa_account` 查额度、`fofa_search` 单页检索、`fofa_export` 全量落盘，由 Agent 直接调用
- **全量导出**：`before="时间"` 游标深翻页（可超 1 万条）、按 host 去重、批次限速；每批**写完即 fsync**，中断不丢已拉数据，可凭 `appendTo` 断点续拉
- **专用对话卡片**：三个工具各有一张默认收起的卡片（账号配额 / 语句 + 命中数 / 语句 + 行数），行头与详情卡沿用 DSH 内置工具卡样式与主题 token
- **插件页配置 Key（推荐）**：卡片写入 Harness 凭据库，不回显；也兼容直接读本机 fofatoto 的 `config.json` 复用 Key
- **额度保护**：`maxExportRows` 上限、时间预算 `maxExportSeconds`、深翻页批次间隔，避免误拉爆额度
- **零 npm 依赖**：只用 Node 内置模块（`fetch`、`fs/promises`、`node:test`），无依赖、无构建步骤

## 安装

### 从 npm 安装（推荐）

已发布到 npm：[`dsh-fofatoto`](https://www.npmjs.com/package/dsh-fofatoto)。

```text
plugin_manager install_bundle  target: dsh-fofatoto
# 或固定版本
plugin_manager install_bundle  target: dsh-fofatoto@0.1.6
```

### 从 GitHub Release 安装（离线、固定版本）

从 [Releases](https://github.com/keyblues/dsh-fofatoto/releases) 下载 `dsh-fofatoto-<version>.tgz`，在插件管理器里填该文件的绝对路径，或：

```text
plugin_manager install_bundle  target: <下载的 .tgz 绝对路径>
```

### 从 GitHub 仓库安装

1. 打开侧边栏「插件」页；
2. 点右上角「添加插件」→「安装第三方插件」；
3. 在「包名或地址」里输入本仓库地址 `https://github.com/keyblues/dsh-fofatoto`；
4. 安装完成后进入插件详情页，在配置卡片里粘贴 FOFA API Key（写入 Harness 凭据库）；
5. 工具随插件自动注册：`fofa_account` / `fofa_search` / `fofa_export`。

要求：Node.js ≥ 20（DSH 内置即可）。更新已安装插件后需要重启 DSH，运行中的进程不会重新加载已修改的 Host 模块。

## 工具

### `fofa_account` — 查额度（不耗额度）

无参数。返回账户类型（官方 / 中转站）、Key 是否有效、今日剩余、剩余查询、到期时间、首次使用、Key 来源。测绘前先调它。

### `fofa_search` — 单页检索（1 次额度/调用）

| 参数 | 说明 |
| --- | --- |
| `query` | 必填，FOFA 语句，如 `domain="a.com" && port="443"` |
| `size` | 返回条数 1–10000，默认 50 |
| `page` | 页码，默认 1（深翻页不稳定，全量请用 export） |
| `fields` | 逗号分隔字段，默认 `host,ip,port,protocol,domain,title`；支持本地拼接的 `url` |
| `full` | 是否 full 数据（含一年前），默认 false |

返回匹配总数、本页行（对象数组）与 IP 去重数。

### `fofa_export` — 全量落盘（按批次数耗额度，增量写盘）

| 参数 | 说明 |
| --- | --- |
| `query` | 多目标可用 `\|\|` 合并；续拉时可省略（沿用元数据） |
| `limit` | 最多拉取条数，默认 1000；`0` 表示按总数（受 `maxExportRows` 保护）；续拉时表示本次新增条数 |
| `format` | `csv`（默认）/ `json` / `txt` |
| `fields` | 同上，`url` 会自动拼好 |
| `dedup` | 去重字段，默认按导出字段；常用 `url`、`ip`、`ip,host`、`domain` |
| `fill` | 拉取比例 (0,1]，默认 1；总量极大时用 0.8 省额度 |
| `fileName` | 输出文件名（不含目录），缺省 `fofa_results_<时间戳>` |
| `appendTo` | **断点续拉**：传上次返回的 `path`，从保存的游标继续追加到同一文件（JSON 不支持） |
| `full` | 是否 full 数据 |

行为：先 `size=1` 查总数 → 按 `before="时间"` 游标分页（每批 ≤ 1 万，批间隔默认 5s）→ 按 host 去重 → 写入 **`<会话工作区>/fofa-output/`**（可配 `outputDir`），重名自动加 `_1`、`_2`。每批结果写完即 `fsync`，文件旁边有 `<文件>.meta.json` 侧车记录格式/字段/游标，供续拉使用。

**超时与中断保护**：每批立即落盘；`maxExportSeconds`（默认 240s）到点在批次之间主动收尾，返回 `partial: true`、`stoppedReason: "time-budget"` 与 `nextBefore` 游标，已拉到的行完整保留；中途 HTTP 失败但已有数据时返回 `partial: true`、`stoppedReason: "upstream-error"`。成功但零结果保留空文件与 meta（`stoppedReason: "empty"`）；硬失败且一行未写则删文件报错。列顺序固定为「请求字段 + 去重字段」，CSV 带 UTF-8 BOM、JSON 用 `[]` 闭合、TXT 按 `ip`/`domain`/`url` 自动选模式。

## 输出格式与对话卡片

三个工具的 `output.render` 都返回 **「一行中文摘要 + 紧凑 JSON」**：摘要行让模型快速定位结果，JSON 与 `output.schema` 一一对应（`additionalProperties: false`）。结果过大时 Harness 会把模型可见内容 spill 落盘，`presentationMeta` 另外持久化一份有界卡片事实，卡片仍能回放配置、条数与预览。

Web 端在 `tool.call.toolview` 注册三张专用卡片（默认收起、点击行头展开）：行头是工具字形 + 标题 + 摘要 + 统计后缀，展开体是官方样式的详情卡（语句、条数、字段、文件路径与统计，或账号配额与有效期）。运行中标题做扫光，失败显示错误摘要，用户停止显示「已停止」；旧日志里的纯 JSON 结果也能正常回放。

## 配置项

配置项都在 `cordis.patch.yml` 的 `config` 里（或 profile 里按 `id: fofatoto` 覆盖），全部可选：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `baseUrl` | `https://fafaapi.info` | 接口地址。默认按中转站；官方账号改成 `https://fofa.info`，也可在插件页卡片直接改（热重载生效） |
| `credentialRef` | `FOFA_API_KEY` | Harness 凭据库引用名 |
| `apiKeyEnv` | `FOFA_KEY` | 环境变量名（兜底） |
| `apiKey` | 空 | 直接写 Key（优先级最高，不推荐） |
| `timeoutMs` | 45000 | 单次 HTTP 超时 |
| `retries` | 2 | 单次请求重试次数 1–4 |
| `defaultFields` | `host,ip,port,protocol,domain,title` | 默认字段（不含 `server`） |
| `outputDir` | 空 | 空 = `<工作区>/fofa-output` |
| `maxExportRows` | 50000 | 单次导出条数上限 |
| `maxExportSeconds` | 240 | 单次导出时间预算（秒，5–540） |
| `rateLimitSeconds` | 5 | 深翻页批次间隔 |
| `fofatotoConfigPath` | 空 | 指向本机 fofatoto 的 `config.json`，未配置 Key 时复用其中 `key` |

**Key 解析顺序**：`config.apiKey` → 凭据库 `FOFA_API_KEY` → 环境变量 `FOFA_KEY` → `fofatotoConfigPath` 的 `config.json`。推荐在「插件」页粘贴 Key 保存（只显示尾号）。

**中转站识别**：账号信息接口内置 `RELAY_INFO_APIS` 表，按域名后缀匹配（`fafaapi.info` → 中转站接口，其余 → 官方 `/api/v1/info/my`），要接新中转站改这张表即可，不新增配置项。切换官方账号：

```yaml
- id: fofatoto
  config:
    baseUrl: https://fofa.info
```

> 插件行的 Loader id 是 `fofatoto`，模块名（包名）是 `dsh-fofatoto`，两者刻意不同。

## 与资产收集流程对接

对应 `asset-collection` skill 第②阶段：

```text
fofa_account                        看今日剩余，规划查询数
  → fofa_search domain="…"          看总量/样本，验证语句
  → fofa_export                     落盘 CSV（--full --dedup url 等价参数都在）
  → fofa_icon 的位置改为：fofatoto --icon <url> → icon_hash="…" → fofa_search
```

## 本地开发与测试

```powershell
node --check index.js
node --check client.js
node --test test/            # 单元测试；live 用例需 FOFA_TEST_KEY，默认 skip
```

在 DSH 里用 `plugin_manager install_bundle` 指向本目录可做 link 安装（开发调试用）。

## 发布与 GitHub 联动

发布到 npm 走 GitHub 联动：`.github/workflows/publish.yml` 在推送 `v*` tag 时用 OIDC（npm Trusted Publishing）执行 `npm publish --provenance`，已发布过的版本会自动跳过发布、只补 Release 资产，避免重复发布报错。

首次发布是在包还不存在时手动做的（此时无法配置 Trusted Publishing）：

```bash
npm login
npm publish --access public     # prepublishOnly 会先跑 node --test
```

包在 npm 上存在后，用 `npm trust github` 配置仓库与 workflow：

```bash
npx npm@latest trust github dsh-fofatoto \
  --repo keyblues/dsh-fofatoto --file publish.yml --allow-publish
```

之后每次发版只需：`npm version patch|minor|major && git push --follow-tags`。

## 兼容性与安全

- Node.js ≥ 20；DSH 版本范围由 `engines.dsh` 声明（`>=0.2.1-rc.5 <0.3.0-0`），装错版本 DSH 会拒绝安装。
- API Key 只存在本机（凭据库/环境变量/你的 fofatoto 配置），不写日志、不回显、不随工具结果返回。
- 插件路由与插件页同源并要求自定义请求头，跨站页面无法静默改写 Key；导出文件落在会话工作区内，文件名做了目录穿越过滤。
- 额度保护：`maxExportRows` 上限 + `fofa_account` 前置检查；`fofa_export` 并发不安全（同时多次导出会互相抢额度）。

## 许可

GPL-3.0-or-later。查询语义移植自同样以 GPL-3.0 发布的 [fofatoto](https://github.com/keyblues/fofatoto)（同一作者）。
