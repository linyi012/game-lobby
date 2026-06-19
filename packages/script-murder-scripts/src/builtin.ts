import type { CreateMurderScriptInput, MurderScriptContent } from './types.js';

export const OFFICIAL_SAMPLE_SCRIPT_ID = 'official-mystery-at-teahouse';

export const officialSampleContent: MurderScriptContent = {
  characters: [
    {
      id: 'char-owner',
      name: '茶庄老板·林掌柜',
      publicProfile: '经营这家老茶庄三十年，与每位常客都很熟。',
      privateScript:
        '你昨晚在库房整理新到的茶叶，听见后院有争执声，但不敢靠近。你知道死者最近与「账册」有关。',
      objectives: '隐藏你曾借过高利贷的事实；找出谁动了账册。',
    },
    {
      id: 'char-scholar',
      name: '落魄书生·沈文',
      publicProfile: '常来喝茶写稿，手头拮据，最近常向人借钱。',
      privateScript:
        '你欠了死者一笔赌债，昨晚来求宽限被拒。你在前堂看见「红袖」匆匆离开后院。',
      objectives: '证明自己没有杀人；尽量把嫌疑引向他人。',
    },
    {
      id: 'char-singer',
      name: '歌女·红袖',
      publicProfile: '在附近戏楼唱曲，偶尔来茶庄小坐。',
      privateScript:
        '你与死者有旧情，昨晚来取回他保管的一封书信。你并未进入后院，只在廊下等候。',
      objectives: '取回书信；不要让人知道你们的关系。',
    },
    {
      id: 'char-guard',
      name: '护院·铁柱',
      publicProfile: '负责茶庄夜间巡逻，为人老实。',
      privateScript:
        '你巡逻时看见「沈文」从后门离开，手里似乎拿着一本薄册。你因打盹错过了案发时刻。',
      objectives: '保住饭碗；如实交代你看到的，但别提打盹。',
    },
  ],
  acts: [
    {
      order: 1,
      title: '第一幕·雨夜茶庄',
      publicText:
        '暴雨夜，茶庄后院发现一具尸体。门窗从内侧闩上，似为密室。四位在场者各执一词，真相尚未明朗。',
      phases: ['intro', 'reading', 'discussion', 'search', 'vote', 'reveal'],
      autoAdvanceSec: 120,
    },
    {
      order: 2,
      title: '第二幕·账册之谜',
      publicText:
        '搜查在后院枯井旁发现半本烧焦的账册，死者似乎因掌握某人的秘密而遭灭口。',
      phases: ['intro', 'reading', 'discussion', 'vote', 'reveal'],
      autoAdvanceSec: 120,
    },
  ],
  clues: [
    {
      id: 'clue-debt',
      title: '借条',
      content: '一张皱巴巴的借条，署名沈文，金额不小，日期为三天前。',
      revealAct: 1,
      visibility: 'search',
    },
    {
      id: 'clue-letter',
      title: '未寄出的信',
      content: '信封上写着红袖的名字，内文提及「今晚来取」。',
      revealAct: 1,
      visibility: 'character',
      characterId: 'char-singer',
    },
    {
      id: 'clue-ledger',
      title: '账册残页',
      content: '账册记录林掌柜曾向死者借银两，利滚利数额惊人。',
      revealAct: 2,
      visibility: 'public',
    },
    {
      id: 'clue-footprint',
      title: '泥泞脚印',
      content: '后门泥地有两组脚印，一大一小，指向不同的离开方向。',
      revealAct: 1,
      visibility: 'search',
    },
  ],
};

export const officialSampleScriptInput: CreateMurderScriptInput = {
  title: '茶馆疑云',
  description: '官方示例剧本：4 人、2 幕，适合初次体验剧本杀流程。',
  minPlayers: 4,
  maxPlayers: 4,
  content: officialSampleContent,
};
