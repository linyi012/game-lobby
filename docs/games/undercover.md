# 谁是卧底

## 基本规则

1. 每位玩家获得一个词语（平民相同，卧底相似，6 人以上可有白板）
2. 按顺序描述自己的词语，**不能直接说出词语**；可发送多条聊天消息后点击「发言结束」
3. 描述完毕后投票，得票最多者淘汰；**平票则本轮无人淘汰**
4. 投票后进入揭晓阶段，展示淘汰结果与是否继续
5. 若淘汰卧底 → 平民胜；若卧底人数 ≥ 平民 → 卧底胜；误投白板 → 白板胜

## 词对包

独立于「你画我猜」词语包，使用 **词对**（平民词 + 卧底词）：

- 官方分类词对库，支持定时从 `WORD_PAIR_UPDATE_URL` 同步
- 用户可维护个人词对包（大厅 → 管理词对包）
- 房主开局前可选择分类、个人词对包、本局临时词对

环境变量：`WORD_PAIR_UPDATE_URL`、`WORD_PAIR_SYNC_INTERVAL_MS`、`WORD_PAIR_SYNC_ON_START`

## 阶段

`describe`（发言）→ `vote`（投票）→ `reveal`（揭晓）→ 继续下一轮 `describe` 或 `ended`

## 状态脱敏

服务端对每个玩家单独投影状态（`requiresPerPlayerState: true`）：

- 仅自己可见词语；白板玩家看到自己无词语
- 投票前不泄露他人身份
- 揭晓/结束后展示淘汰者身份；游戏结束时展示本局词对

## Socket 事件

| 方向 | 事件 | 说明 |
|------|------|------|
| C→S | `game:undercover:speech` | `{ text }` 当前发言者发送描述 |
| C→S | `game:undercover:end-speaking` | 结束本轮发言 |
| C→S | `game:undercover:vote` | `{ targetId }` 投票 |
| C→S | `game:undercover:continue-reveal` | 揭晓后继续（也可自动倒计时） |
| S→C | `game:state` | 按玩家脱敏后的状态 |

## 人数要求

- 最少 4 人，最多 12 人
- 不支持电脑玩家

## 相关代码

- 逻辑：`packages/games/undercover/src/logic.ts`
- 词对包：`packages/word-pairs/`
- 服务端 API：`apps/server/src/routes/word-pairs.ts`
- UI：`apps/web/src/games/undercover/`
