<p align="center">
  <img src="src/asset/img/dagong.png" width="104" alt="Dagong 图标">
</p>

<h1 align="center">Dagong</h1>

<p align="center">
  <strong>探索下一代 Agent 范式。</strong>
</p>

<p align="center">
  <a href="./README.en.md">English</a>
  &nbsp;·&nbsp;
  <strong>简体中文</strong>
  &nbsp;·&nbsp;
  <a href="https://github.com/polimao/Dagong/releases">下载</a>
  &nbsp;·&nbsp;
  <a href="#文档地图">文档</a>
</p>

<p align="center">
  <a href="https://github.com/polimao/Dagong/releases"><img src="https://img.shields.io/github/v/release/polimao/Dagong?label=release" alt="GitHub release"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue" alt="License: PolyForm Noncommercial 1.0.0"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/Electron-34-47848F?logo=electron&logoColor=white" alt="Electron 34">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19">
</p>

Dagong 是一次面向未来编程方式的产品实验：不再从“给 Agent 一句话，让它直接改代码”开始，而是从需求澄清开始，把需求文档、Design 设计稿、交互原型、实施计划、Todo、Agent 编码和变更审查放到一条连续的 GUI 工作流里。

Dagong 面向希望把 AI Agent 真正放进日常工作的用户。它不是只聊天的客户端，也不是只给程序员的 CLI 外壳：你可以在 Code 模式把本地目录交给它处理代码、需求、计划和变更审查，在 Design 模式生成和迭代 UI 设计稿、交互原型与共享设计系统，也可以在独立的 Write 工作区里写作、润色和导出文档。

这也是 Dagong 为什么把 DeepSeek、Xiaomi MiMo、MiniMax 作为默认的一线模型组合，而不是把它们当成普通的“可选 Provider”。 Agent 范式会带来更多轮澄清、调研、结构化、规划、执行和验证，如果模型成本太高，这条流程很难成为日常工作方式。Dagong 选择三家来自中国的高性价比模型供应商，正是为了让完整流程跑得起、用得久、试得多。

Dagong 内置同名本地运行时，通过 `dagong serve` 连接桌面端。会话、日志、偏好设置和运行时配置默认保存在本机；模型请求使用你自己的模型服务凭据。对会读写文件和执行命令的流程，Dagong 提供工具审批、权限模式、内联 diff 和变更审查面板。

---

<p align="center">
  <a href="src/asset/img/code.mp4">
    <img src="src/asset/img/code.gif" width="410" alt="Dagong Code 模式演示">
  </a>
  <a href="src/asset/img/write.mp4">
    <img src="src/asset/img/write.gif" width="410" alt="Dagong Write 模式演示">
  </a>
</p>

## 更多演示

<p align="center">
  <a href="src/asset/img/pdf-research.mp4">
    <img src="src/asset/img/pdf-research.gif" width="680" alt="PDF 研究演示">
  </a>
</p>
<p align="center"><em>PDF 研究与资料整理演示</em></p>

<p align="center">
  <a href="src/asset/img/sdd.mp4">
    <img src="src/asset/img/sdd.gif" width="680" alt="需求澄清、需求文档与计划演示">
  </a>
</p>
<p align="center"><em>需求澄清、需求文档与计划演示</em></p>

<p align="center">
  <a href="src/asset/img/idagong-ui-plugin.mp4">
    <img src="src/asset/img/idagong-ui-plugin.gif" width="680" alt="iDagong UI 插件演示">
  </a>
</p>
<p align="center"><em>iDagong UI 插件演示</em></p>

## 快速开始

### 路径 A：下载发布版

前往 [GitHub Releases](https://github.com/polimao/Dagong/releases) 下载最新版本。

| 平台 | 安装包 | 架构 |
| --- | --- | --- |
| macOS | `.dmg` 或 `.zip` | Intel / Apple Silicon |
| Windows | `.exe`，NSIS 安装器 | x64 |
| Linux | `.AppImage` | x64 |

首次启动时：

1. 选择界面语言。
2. 选择模型服务并填写 API Key 或 Token Plan Key。
3. 如需兼容服务，在设置里编辑 Base URL、协议和模型列表。
4. 进入 Code 绑定本地项目，进入 Design 生成设计原型，或进入 Write 创建写作工作区。

### 路径 B：从源码运行

环境要求：

| 依赖 | 版本 |
| --- | --- |
| Node.js | 20+ |
| npm | 随 Node.js 安装 |
| 模型服务凭据 | DeepSeek / Xiaomi MiMo / MiniMax / 自定义 Provider 至少一个 |

```bash
git clone https://github.com/polimao/Dagong.git
cd Dagong
npm install
npm run dev
```

中国大陆访问较慢时，可以使用 npm 镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

## 文档地图

| 文档 | 内容 |
| --- | --- |
| [dagong/README.zh-CN.md](dagong/README.zh-CN.md) | Dagong 运行时、CLI、环境变量、HTTP API |
| [docs/dagong-architecture.md](docs/dagong-architecture.md) | 单运行时架构与 GUI 集成 |
| [docs/dagong-cache-optimization.md](docs/dagong-cache-optimization.md) | 缓存优化、token economy 与可观测性 |
| [docs/DESIGN_MODE.md](docs/DESIGN_MODE.md) | Design 设计模式、画布、原型、设计系统与 Design -> Code 闭环 |
| [docs/model-provider-presets.md](docs/model-provider-presets.md) | 模型 Provider 预设与扩展能力 |
| [docs/workflow-loop.md](docs/workflow-loop.md) | Loop 循环节点与 loop-agent 思想（创建loop / 工作流） |
| [docs/DEVELOPMENT.zh-CN.md](docs/DEVELOPMENT.zh-CN.md) | 本地开发流程、分支策略和发布说明 |
| [SECURITY.zh-CN.md](SECURITY.zh-CN.md) | 安全漏洞披露方式 |

