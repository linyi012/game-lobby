import { emitWithAck } from '../../lib/emit-with-ack';

type Ack = { ok: boolean; message?: string };

function emit(event: string, payload: unknown = {}): Promise<Ack> {
  return emitWithAck<Ack>(event, payload);
}

export function emitProposeTeam(memberIds: string[]) {
  return emit('game:avalon:propose_team', { memberIds });
}

export function emitTeamVote(approve: boolean) {
  return emit('game:avalon:team_vote', { approve });
}

export function emitMissionCard(success: boolean) {
  return emit('game:avalon:mission_card', { success });
}

export function emitContinue() {
  return emit('game:avalon:continue', {});
}

export function emitLadyPick(targetId: string) {
  return emit('game:avalon:lady_pick', { targetId });
}

export function emitAssassinate(targetId: string) {
  return emit('game:avalon:assassinate', { targetId });
}

export function emitEvilChat(text: string) {
  return emit('game:avalon:evil_chat', { text });
}
