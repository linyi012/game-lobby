# Game Lobby — 聚会游戏大厅

多人在线聚会游戏平台，支持「谁是卧底」与「达芬奇密码」，可添加电脑玩家（4 种难度），房主可管理游戏队列与玩家/旁观分配。

## 技术栈

| 层级 | 技术 |
|------|------|
| Monorepo | pnpm workspaces |
| 前端 | React 18 + Vite + TypeScript |
| 后端 | Node.js + Express + Socket.io |
| 数据库 | PostgreSQL + Drizzle ORM |
| 共享 | `@game-lobby/shared` 类型与常量 |

## 项目结构

```
game-lobby/
├── apps/
│   ├── web/                 # React 前端（登录、大厅、房间、游戏 UI）
│   └── server/              # Express API + Socket.io 实时通信
├── packages/
│   ├── shared/              # 跨端共享类型、游戏元数据
│   ├── db/                  # Drizzle Schema 与数据库连接
│   └── game-engine/         # 游戏核心逻辑与电脑 AI
├── docs/                    # 项目文档
├── package.json
└── pnpm-workspace.yaml
```

## 快速开始

### 1. 环境要求

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 14

### 2. 安装依赖

```bash
cd game-lobby
pnpm install
```

### 3. 配置数据库

复制环境变量并按需修改：

```bash
cp .env.example .env
```

创建数据库：

```sql
CREATE DATABASE game_lobby;
```

推送 Schema：

```bash
pnpm db:push
```

### 4. 启动开发服务

```bash
pnpm dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3001

## 功能概览

- **账户系统**：注册 / 登录，JWT 鉴权
- **游戏大厅**：实时查看所有房间、当前游戏、在线玩家
- **房间系统**：创建/加入房间，房主权限管理
- **游戏队列**：房主排序下一局游戏，或设为随机
- **人数适配**：当游戏人数与房间人数不匹配时，房主可指定玩家/旁观
- **电脑玩家**：简单 / 普通 / 困难 / 专家 四档难度
- **响应式布局**：适配手机、平板与桌面浏览器

## 已实现游戏

| 游戏 | 标识 | 人数 |
|------|------|------|
| 谁是卧底 | `undercover` | 4–12 |
| 达芬奇密码 | `da_vinci_code` | 2–4 |

## 文档索引

- [架构说明](docs/architecture.md)
- [开发指南](docs/development.md)
- [谁是卧底规则](docs/games/undercover.md)
- [达芬奇密码规则](docs/games/da-vinci-code.md)

## 常用命令

```bash
pnpm dev          # 同时启动前后端
pnpm build        # 构建所有包
pnpm db:generate  # 生成迁移文件
pnpm db:migrate   # 执行迁移
pnpm typecheck    # 类型检查
```

## License

MIT
