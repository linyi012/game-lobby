# 狼人杀

## 基本规则

1. 狼人夜间刀人，好人白天讨论并投票放逐
2. 支持 6–12 人，角色板可预设或自定义
3. 屠边规则：狼人数量 ≥ 存活好人时狼胜；所有狼人出局则好人胜

## 角色

狼人、村民、预言家、女巫、猎人、守卫、白痴（详见 `packages/games/werewolf/src/logic.ts`）

## 阶段

`night_wolf` → `night_seer` → `night_witch` → `night_guard` → 结算 → `day_announce` → `day_discuss` → `day_vote` → `reveal` → 下一夜或 `ended`

## Socket 事件

| 方向 | 事件 | 说明 |
|------|------|------|
| C→S | `game:werewolf:wolf_vote` | `{ targetId }` |
| C→S | `game:werewolf:wolf_chat` | `{ text }` |
| C→S | `game:werewolf:seer_peek` | `{ targetId }` |
| C→S | `game:werewolf:witch_act` | `{ action, targetId? }` |
| C→S | `game:werewolf:guard_protect` | `{ targetId }` |
| C→S | `game:werewolf:speech` | `{ text }` |
| C→S | `game:werewolf:end_speaking` | 结束发言 |
| C→S | `game:werewolf:day_vote` | `{ targetId }` |
| C→S | `game:werewolf:hunter_shoot` | `{ targetId }` |
| C→S | `game:werewolf:skip_hunter` | 猎人放弃开枪 |
| C→S | `game:werewolf:continue` | 公布/揭晓后继续 |
| S→C | `game:state` | 按玩家脱敏后的状态 |

## 相关代码

- 逻辑：`packages/games/werewolf/src/logic.ts`
- UI：`apps/web/src/games/werewolf/`
