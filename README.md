# Lobster Architecture Platform - 龙虾架构平台

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?style=for-the-badge&logo=tailwindcss)
![Zustand](https://img.shields.io/badge/Zustand-4-orange?style=for-the-badge&logo=zustand)

**AI Agent Team Management Platform with 16-bit Pixel Art Style**

[Quick Start](#-快速开始) · [Features](#-功能模块) · [Architecture](#-项目架构) · [Tech Stack](#-技术栈)

</div>

---

## Overview | 项目概览

Lobster Architecture Platform is an AI Agent Team Management Platform built with a distinctive **16-bit pixel art aesthetic** inspired by classic NES/Famicom game palettes. It allows you to adopt, manage, and coordinate multiple AI agents ("Lobsters") in collaborative workflows called "Architectures".

龙虾架构平台是一个具有复古红白机像素艺术风格的 AI 智能体团队管理平台。你可以领养、管理和协调多个 AI 智能体（"龙虾"），以协作工作流（"架构"）的形式完成复杂任务。

---

## Screenshots | 界面预览

### Homepage | 首页

```
┌─────────────────────────────────────────────────────────────────────┐
│  [LOGO]  龙虾架构平台  LOBSTER ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                    欢迎来到龙虾世界                                  │
│                  WELCOME TO LOBSTER WORLD                           │
│                                                                     │
│  ┌──────────────────────────┐  ┌──────────────────────────┐         │
│  │  LOBSTER TOWN            │  │  TASK CONTROL            │         │
│  │  ────────────────────     │  │  ────────────────────     │         │
│  │  [ADOPT]  Quick Adopt    │  │  [CREATE] New Architecture│        │
│  │  [UPLOAD] Import Package │  │  [DEFAULTS] Browse Templates│      │
│  │  [MARKET] Buy Lobsters   │  │  [MINE] My Architectures │         │
│  │  [MY-DEN] My Lobsters    │  │                           │         │
│  └──────────────────────────┘  └──────────────────────────┘         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  龙虾架构平台 - 高效AI团队协作 | READY.                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Architecture Pipeline | 架构流水线

```
  ┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐
  │ MANAGER │───▶│ AGENT │───▶│ AGENT │───▶│ AGENT │
  │  [O]   │    │  [O]  │    │  [O]  │    │  [O]  │
  └──────┘     └──────┘     └──────┘     └──────┘
   standby      standby      standby      standby
```

### Pixel Canvas | 像素编辑器

```
  ┌──────────────────────────────────────┐
  │  PIXEL LOBSTER DESIGN STUDIO        │
  │  ─────────────────────────────────   │
  │  Grid: [32x32 ▼]  Output: [64px ▼]   │
  │  ┌────────────────────────────┐       │
  │  │ ▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░ │       │
  │  │ ░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │       │
  │  │ ░░▓▓▓▓▓▓░░▓▓▓▓▓▓░░▓▓▓▓▓▓▓ │       │
  │  │ ▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░ │       │
  │  └────────────────────────────┘       │
  │  [CLEAR]  [SAVE TOURSELF]             │
  └──────────────────────────────────────┘
```

---

## Features | 功能模块

### 1. Lobster Town | 龙虾城镇中心

#### 1.1 Quick Adopt | 快速领养

Randomly generate a new lobster with a unique name, role, and pixel sprite.

```
  [Egg Animation] ──hatching──▶ [New Lobster Card]
  ┌────────┐                    ┌─────────────┐
  │  (o)   │ ──▶ 100% ──▶      │  [LOBSTER]  │
  │  (  )  │                    │  Name: ???  │
  └────────┘                    │  Role: ???  │
                                │  Status:IDLE│
                                └─────────────┘
```

#### 1.2 Import Package | 上传龙虾

Upload a local lobster package (.zip) and optionally publish it to the marketplace.

```
  [Floppy Icon]  Upload Lobster Package
  ┌──────────────────────────────────┐
  │  ┌────────────────────────────┐  │
  │  │      DROP .ZIP HERE        │  │
  │  │    or click to browse      │  │
  │  └────────────────────────────┘  │
  │  Lobster Name: [_________]       │
  │  Publish to Market: [  ]          │
  │           [UPLOAD]                │
  └──────────────────────────────────┘
```

#### 1.3 Lobster Market | 龙虾市场

Buy special lobsters from a merchant with virtual coins. Rarity tiers from Common to Legend.

| Rarity    | Color   | Price Range | Description                      |
|-----------|---------|-------------|----------------------------------|
| Common    | Green   | 50-100      | Basic skill lobsters            |
| Uncommon  | Blue    | 150-300     | Enhanced capabilities           |
| Rare      | Purple  | 400-700     | Specialized agents              |
| Epic      | Orange  | 800-1200    | Advanced AI collaborators        |
| Legend    | Red     | 1500-2000   | Top-tier autonomous agents      |

Marketplace lobsters include: Red Hood Researcher, Data Doctor, Code Hero, Research Cat, Translator, Artist, and more.

#### 1.4 My Den | 我的龙虾窝

Organize your lobsters into colorful caves. Each cave has a distinct color and name.

```
  ┌─ Cave: Research Team (BLUE) ──────────────┐
  │  [Lobster-001]  [Lobster-002]  [Lobster-003] │
  │   IDLE            WORKING        BUSY         │
  └────────────────────────────────────────────┘
  ┌─ Cave: Creative (GREEN) ──────────────────┐
  │  [Lobster-004]  [Lobster-005]               │
  │   IDLE            IDLE                      │
  └────────────────────────────────────────────┘
```

**Lobster Status System:**

| Status | Color  | Animation          | Description          |
|--------|--------|--------------------|----------------------|
| IDLE   | Green  | Gentle sway        | Waiting for tasks    |
| WORKING| Yellow | Rotation wobble    | Processing tasks     |
| BUSY   | Red    | Pulse effect       | High load            |

---

### 2. Task Control | 任务控制中心

#### 2.1 Create Architecture | 创建架构

Two creation modes:
- **Canvas Mode**: Drag-and-drop node editor using ReactFlow
- **Chat Mode**: Natural language description generates architecture

```
  Canvas Mode:
  ┌────────────────────────────────────────────────┐
  │  ┌─────┐         ┌─────┐         ┌─────┐       │
  │  │START│────────▶│AGENT│────────▶│ END │       │
  │  └─────┘         └─────┘         └─────┘       │
  │              [ADD NODE]  [DELETE]  [SAVE]       │
  └────────────────────────────────────────────────┘

  Chat Mode:
  ┌────────────────────────────────────────────────┐
  │  > Create a research team with planner and     │
  │    analyst agents...                           │
  │  ─────────────────────────────────────────     │
  │  ✓ Created architecture: Research Team         │
  │    - Manager Agent (OpenClaw Gateway)           │
  │    - Research Planner Agent                     │
  │    - Data Analyst Agent                         │
  └────────────────────────────────────────────────┘
```

#### 2.2 Default Templates | 默认架构模板

7 pre-built architecture templates ready to use:

| #  | Template           | Pattern     | Use Case                    |
|----|--------------------|-------------|-----------------------------|
| 1  | 研究团队           | Linear+Review| Academic research workflow  |
| 2  | 创意工作室         | Fork-Join   | Creative content generation |
| 3  | 代码工厂           | Parallel Dev| Software development        |
| 4  | 内容创作工厂       | Pipeline    | Content production          |
| 5  | 三省六部制         | Hierarchical| Historical governance sim   |
| 6  | 软件开发生命周期   | SDLC Loop   | Full development lifecycle  |
| 7  | 政府行政流程       | Sequential  | Administrative workflows    |

#### 2.3 My Architectures | 我的架构

Manage all your created architectures. Each card shows:
- Architecture name and description
- Agent count and member chips
- Creation date
- Quick access to detail page

---

### 3. Architecture Detail | 架构详情页

#### 3.1 Pipeline Flow | 动态流水线

Visual pipeline showing all agents as pixel characters with animated status:

```
  ┌────────────────────────────────────────────────────────────────┐
  │  MANAGER AGENT              AGENT 1        AGENT 2    AGENT 3  │
  │     [O] ───────────▶         [O] ─────────▶  [O] ─────▶ [O]   │
  │   STANDBY                   STANDBY        STANDBY     STANDBY │
  │  linked: lobster-001   linked: lobster-002  lobster-003 lobster-004│
  └────────────────────────────────────────────────────────────────┘
```

**Agent Status System:**

| Status     | Color | Animation                        |
|------------|-------|----------------------------------|
| STANDBY    | Gray  | Horizontal shake                 |
| ACTIVE     | Green | Vertical bounce                   |
| EXECUTING  | Yellow| Rotation + BEEP/BOOP particles    |

#### 3.2 Chat Interface | 全局对话框

Real-time task submission and agent response with markdown rendering:

```
  ┌────────────────────────────────────────────────────────┐
  │  TASK: Research paper on quantum computing            │
  │  ─────────────────────────────────────────────────     │
  │                                                        │
  │  [Manager Agent]: Task received. Routing to team...   │
  │  [Research Planner]: Creating research outline...      │
  │  [Data Analyst]: Running simulations... BEEP            │
  │  [Research Writer]: Drafting section 1...             │
  │                                                        │
  │  ┌────────────────────────────────────────────────┐    │
  │  │ > Research paper on quantum computing         │    │
  │  └────────────────────────────────────────────────┘    │
  │                                      [SEND]             │
  └────────────────────────────────────────────────────────┘
```

#### 3.3 Node Flow Preview | 节点流预览

Interactive ReactFlow-based graph visualization with:
- Custom node types (Agent, Condition, Start, End)
- Animated data flow edges
- Hover tooltips showing lobster details
- Link/unlink lobsters to agents

---

### 4. Pixel Design Studio | 像素编辑器

Draw custom lobster sprites with a built-in pixel art canvas:

- Adjustable grid size: 32x32, 64x64, 96x96, 128x128
- Adjustable output size: 48px, 64px, 96px, 128px
- Live preview
- Auto-generate skill descriptions from selected tags
- Export as DataURL for lobster avatar

---

### 5. OpenClaw Gateway Integration | OpenClaw 网关集成

Connect with the local OpenClaw Gateway (port 18789) for real AI agent communication:

- Session management
- Task spawning
- Real-time chat with agents
- Connection status indicators

---

## Tech Stack | 技术栈

| Category       | Technology                   | Purpose                              |
|----------------|------------------------------|--------------------------------------|
| Framework      | Next.js 14 (App Router)      | React framework with SSR/SSG        |
| Language       | TypeScript 5                 | Type-safe development                |
| Styling        | Tailwind CSS 3              | Utility-first CSS framework          |
| Animation      | Framer Motion 11             | Declarative animations               |
| State          | Zustand 4                   | Lightweight state management         |
| Node Editor    | @xyflow/react 12             | ReactFlow for architecture graphs    |
| Markdown       | react-markdown + remark-gfm | Rich text rendering                   |
| Fonts          | VT323, ZCOOL KuaiLe         | Pixel art typography                 |
| Backend        | Express + SQLite             | Real API, workspace, and agent runtime services |

---

## Project Structure | 项目结构

```
openclaw_company_source_code/
├── next-lobster-platform/           # Next.js Frontend
│   ├── src/
│   │   ├── app/                    # Page routes
│   │   │   ├── page.tsx           # Homepage
│   │   │   ├── adopt/             # Quick adopt page
│   │   │   ├── upload/            # Upload & design pages
│   │   │   ├── market/            # Marketplace page
│   │   │   ├── my-den/            # Lobster den pages
│   │   │   └── architectures/     # Architecture pages
│   │   │       ├── create/        # Create architecture
│   │   │       ├── defaults/      # Template gallery
│   │   │       └── mine/          # User's architectures
│   │   │
│   │   ├── components/             # React components
│   │   │   ├── ui/                # Pixel UI primitives
│   │   │   ├── lobster/           # Lobster display & cards
│   │   │   ├── architecture/      # Architecture visualization
│   │   │   ├── pixel/             # Pixel art canvas
│   │   │   └── layout/            # Layout components
│   │   │
│   │   ├── store/                 # Zustand state store
│   │   ├── lib/                   # API clients & utilities
│   │   └── types/                 # TypeScript definitions
│   │
│   ├── public/
│   │   └── lobsters/              # Lobster sprite images
│   │       ├── lobster-001.png    # OpenClaw Main Agent
│   │       ├── lobster-002.png    # Research Specialist
│   │       ├── lobster-003.png    # Data Analyst
│   │       ├── lobster-004.png    # Research Writer
│   │       └── market-*.png       # Marketplace lobsters
│   │
│   └── package.json               # Frontend dependencies
│
└── README.md                       # This file
```

---

## Design System | 设计规范

### Color Palette | 像素调色板 (NES/FC Colors)

| Color    | Hex       | Usage                        |
|----------|-----------|------------------------------|
| Red      | `#E50000` | Primary actions, alerts      |
| Green    | `#009E00` | Success, idle status         |
| Blue     | `#0051BA` | Information, headers         |
| Orange   | `#FFA000` | Hover states, warnings       |
| Yellow   | `#FFEC27` | Working status, highlights   |
| Brown    | `#8B4513` | Borders, shadows             |
| Cyan     | `#00A8E8` | Links, accents               |
| White    | `#F8F8F8` | Background, text on dark     |
| Black    | `#101010` | Borders, shadows, backgrounds |

### Typography | 字体系统

- **VT323** (Google Fonts) - Retro pixel font for English text
- **ZCOOL KuaiLe** (Google Fonts) - Chinese pixel font for headings

### Pixel Border | 像素边框

```css
/* Standard pixel border */
border: 4px solid #101010;
box-shadow: 6px 6px 0px 0px #101010;
```

---

## Getting Started | 快速开始

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### 1. Install Dependencies

```bash
# Frontend
cd next-lobster-platform
npm install

# Backend
cd ../backend
npm install
```

### 2. Start Backend

```bash
cd backend
npm run dev
# API runs at http://localhost:3002
```

### 3. Start Frontend

```bash
cd next-lobster-platform
npm run dev
# Open http://localhost:3000
```

---

## Key Files | 核心文件

| File | Description |
|------|-------------|
| `src/store/useStore.ts` | Zustand store - all application state |
| `src/types/index.ts` | TypeScript interfaces for Lobster, Architecture, Agent |
| `src/lib/openclaw.ts` | OpenClaw Gateway API client |
| `src/lib/api.ts` | REST API client for the backend services |
| `src/lib/archTemplates.ts` | Pre-defined architecture templates |
| `src/components/architecture/NodeFlowPreview.tsx` | ReactFlow graph visualization |
| `src/components/lobster/LobsterSprite.tsx` | Animated lobster sprite renderer |
| `src/app/architectures/create/NodeCanvas.tsx` | Architecture node editor |
| `src/components/pixel/PixelCanvas.tsx` | Pixel art drawing canvas |

---

## License | 许可证

MIT License - Feel free to use and modify for your projects.

---

<div align="center">

**Built with pixel love | 用像素之爱构建**

Lobster Architecture Platform - AI Agent Team Management

</div>
