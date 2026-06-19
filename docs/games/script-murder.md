# 剧本杀

## 基本规则

1. 房主创建房间并选择剧本，玩家人数须与剧本角色数一致
2. 按幕推进：`intro → reading → discussion → search → vote → reveal`
3. 房主担任主持人，可暂停/推进阶段、公开线索、跳幕
4. 未暂停时各阶段按剧本配置的超时自动推进

## 数据结构

剧本内容（`MurderScriptContent`）包含：

- **acts**：幕次（公开叙事、阶段序列、超时秒数）
- **characters**：角色（公开简介、私密角色本、目标）
- **clues**：线索（出现幕、可见性：public / character / search）

详见 `packages/script-murder-scripts/src/types.ts`。

## REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/script-murder/scripts/mine` | 我的剧本 |
| GET | `/api/script-murder/scripts/official` | 官方剧本 |
| GET | `/api/script-murder/scripts/playable` | 可选用剧本 |
| POST/PATCH/DELETE | `/api/script-murder/scripts` | CRUD |

## Socket 事件

| 方向 | 事件 | 说明 |
|------|------|------|
| C→S | `game:script_murder:speech` | `{ text }` 讨论发言 |
| C→S | `game:script_murder:vote` | `{ targetId }` 投票 |
| C→S | `game:script_murder:search_clue` | `{ clueId }` 搜证 |
| C→S | `game:script_murder:host_advance` | 主持人推进 |
| C→S | `game:script_murder:host_reveal_clue` | `{ clueId }` 公开线索 |
| C→S | `game:script_murder:host_pause` | `{ paused }` 暂停/恢复 |
| C→S | `game:script_murder:host_jump_act` | `{ actIndex }` 跳幕 |
| C→S | `game:script_murder:continue` | 揭晓后继续 |
| S→C | `game:state` | 按玩家脱敏 |

开局时在 `game:start` 传入 `{ scriptId }`，服务端加载剧本并注入 `createGame`。

## 相关代码

- 剧本类型与校验：`packages/script-murder-scripts/`
- 逻辑：`packages/games/script-murder/src/logic.ts`
- 剧本 CRUD：`apps/server/src/services/script-murder-service.ts`
- UI：`apps/web/src/games/script-murder/`
