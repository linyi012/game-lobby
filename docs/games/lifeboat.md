# 怒海求生（Lifeboat）

## 基本规则

1. 4–6 名玩家扮演救生艇上的落难者，按船头→船尾排成一线
2. 每回合三阶段：**补给**（轮流选物资）→ **行动**（划船/换位/抢夺/特殊/跳过）→ **航海**（舵手执行划船牌）
3. 秘密 **爱** 与 **恨** 各指向一名角色；结束时爱者存活、恨者死亡均可得分
4. 海鸥累计 **4 只** 游戏结束；也可因全员死亡结束
5. 不支持电脑玩家

## 角色（基础版 6 选 N）

| 角色 | 体力 | 力量 | 能力 |
|------|------|------|------|
| 船长 | 4 | 6 | 航海时可见全部划船牌 |
| 绅士 | 3 | 5 | 不可被抢夺 |
| 女士 | 3 | 5 | 与绅士相邻时战斗 +1 力 |
| 法国佬 | 3 | 4 | 落水不受伤害 |
| 富豪 | 3 | 4 | 存活额外 +2 分 |
| 小孩 | 2 | 3 | 抢夺不触发战斗 |

## 阶段

`supply_draft` → `action` → (`pending_response` → `combat`) → `navigation_pick` → `thirst_resolve` → 下一回合或 `ended`

## Socket 事件

| 方向 | 事件 | 说明 |
|------|------|------|
| C→S | `game:lifeboat:supply_pick` | `{ cardIndex }` |
| C→S | `game:lifeboat:action` | `{ type, targetPlayerId?, supplyCardId?, specialCardId? }` |
| C→S | `game:lifeboat:respond` | `{ accept }` |
| C→S | `game:lifeboat:combat_support` | `{ side: 'attacker' \| 'defender' \| 'none' }` |
| C→S | `game:lifeboat:navigation_pick` | `{ cardIndex }` |
| C→S | `game:lifeboat:play_supply` | `{ cardId, context? }` |
| C→S | `game:lifeboat:skip_thirst` | 口渴扣血 |
| S→C | `game:state` | 按玩家脱敏（手牌、爱恨） |

## 相关代码

- 逻辑：`packages/games/lifeboat/src/logic.ts`
- 角色/牌库：`packages/games/lifeboat/src/characters.ts`、`cards.ts`
- UI：`apps/web/src/games/lifeboat/`
