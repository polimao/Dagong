<p align="center">
  <img src="src/asset/img/dagong.png" width="104" alt="Dagong icon">
</p>

<h1 align="center">Dagong</h1>

<p align="center">
  <strong>An experiment in requirement-first Agent for the next paradigm.</strong><br>
  Use DeepSeek, Xiaomi MiMo, and MiniMax to connect requirements, Design, Code, and Write into one loop.
</p>

<p align="center">
  <a href="./README.md">简体中文</a>
  &nbsp;·&nbsp;
  <strong>English</strong>
  &nbsp;·&nbsp;
  <a href="https://github.com/polimao/Dagong/releases">Download</a>
  &nbsp;·&nbsp;
  <a href="#documentation-map">Docs</a>
  &nbsp;·&nbsp;
  <a href="#path-b-run-from-source">Run from source</a>
</p>

<p align="center">
  <a href="https://github.com/polimao/Dagong/releases"><img src="https://img.shields.io/github/v/release/polimao/Dagong?label=release" alt="GitHub release"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue" alt="License: PolyForm Noncommercial 1.0.0"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/Electron-34-47848F?logo=electron&logoColor=white" alt="Electron 34">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19">
</p>

Dagong is a product experiment for the future of programming: instead of starting from “ask the agent to edit code,” it starts from requirement clarification and connects requirement documents, Design drafts, interactive prototypes, implementation plans, todos, agentic work, and change review in one GUI workflow.

Dagong is for users who want to put AI agents into real everyday work. It is not just a chat client, and it is not only a CLI shell for programmers: in Code mode you can hand it a local folder for code, requirements, plans, and change review; in Design mode you can generate and iterate UI drafts, interactive prototypes, and a shared design system; in Write mode you can work on long-form Markdown, editing, and document export.

This is also why Dagong treats DeepSeek, Xiaomi MiMo, and MiniMax as the default first-class model stack, not just ordinary optional providers. Requirement-first agentic work requires more rounds of clarification, research, structuring, planning, execution, and verification. If model cost is too high, that richer workflow cannot become an everyday habit. Dagong chooses three cost-efficient Chinese model providers so the full loop is affordable to run, repeat, and refine.

Dagong includes the local `dagong serve` runtime for the desktop app. Preferences, sessions, logs, and runtime config stay on your machine; model calls use your own provider credentials. For workflows that can read/write files or run commands, Dagong gives you tool approvals, filesystem permission modes, inline diffs, and a change-review panel.

---

<p align="center">
  <a href="src/asset/img/code.mp4">
    <img src="src/asset/img/code.gif" width="410" alt="Dagong Code mode demo">
  </a>
  <a href="src/asset/img/write.mp4">
    <img src="src/asset/img/write.gif" width="410" alt="Dagong Write mode demo">
  </a>
</p>

## More Demos

<p align="center">
  <a href="src/asset/img/pdf-research.mp4">
    <img src="src/asset/img/pdf-research.gif" width="680" alt="PDF research demo">
  </a>
</p>
<p align="center"><em>PDF research and source organization demo</em></p>

<p align="center">
  <a href="src/asset/img/sdd.mp4">
    <img src="src/asset/img/sdd.gif" width="680" alt="Requirement clarification, requirement documents, and planning demo">
  </a>
</p>
<p align="center"><em>Requirement clarification, requirement documents, and planning demo</em></p>

<p align="center">
  <a href="src/asset/img/idagong-ui-plugin.mp4">
    <img src="src/asset/img/idagong-ui-plugin.gif" width="680" alt="iDagong UI plugin demo">
  </a>
</p>
<p align="center"><em>iDagong UI plugin demo</em></p>

## Quick Start

### Path A: Download a Release

Download the latest build from [GitHub Releases](https://github.com/polimao/Dagong/releases).

| Platform | Package | Architecture |
| --- | --- | --- |
| macOS | `.dmg` or `.zip` | Intel / Apple Silicon |
| Windows | `.exe`, NSIS installer | x64 |
| Linux | `.AppImage` | x64 |

On first launch:

1. Choose a UI language.
2. Choose a model provider and enter an API key or Token Plan key.
3. For compatible providers, edit the Base URL, protocol, and model list in Settings.
4. Open Code to bind a local project, open Design to generate a prototype, or open Write to create a writing workspace.

### Path B: Run From Source

Requirements:

| Dependency | Version |
| --- | --- |
| Node.js | 20+ |
| npm | Ships with Node.js |
| Model credentials | At least one of DeepSeek / Xiaomi MiMo / MiniMax / custom provider |

```bash
git clone https://github.com/polimao/Dagong.git
cd Dagong
npm install
npm run dev
```

For slower network access in mainland China, use an npm mirror:

```bash
npm install --registry=https://registry.npmmirror.com
```

## Documentation Map

| Doc | Contents |
| --- | --- |
| [dagong/README.md](dagong/README.md) | Dagong runtime, CLI, environment variables, HTTP API |
| [docs/dagong-architecture.en.md](docs/dagong-architecture.en.md) | Runtime architecture and GUI integration |
| [docs/dagong-cache-optimization.en.md](docs/dagong-cache-optimization.en.md) | Cache optimization and token economy |
| [docs/DESIGN_MODE.md](docs/DESIGN_MODE.md) | Design mode, canvas, prototypes, design systems, and the Design -> Code loop |
| [docs/model-provider-presets.md](docs/model-provider-presets.md) | Model provider presets |
| [docs/workflow-loop.en.md](docs/workflow-loop.en.md) | The Loop node and the loop-agent idea (Create Loop workflows) |
| [docs/DEVELOPMENT.en.md](docs/DEVELOPMENT.en.md) | Local development workflow |
| [SECURITY.md](SECURITY.md) | Security disclosure policy |

