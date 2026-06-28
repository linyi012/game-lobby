import type { Socket } from 'socket.io';
import { registerUndercoverSockets } from './undercover/socket.js';
import { registerDaVinciSockets } from './da-vinci-code/socket.js';
import { registerDrawGuessSockets } from './draw-guess/socket.js';
import { registerActGuessSockets } from './act-guess/socket.js';
import { registerHeartAttackSockets } from './german-heart-attack/socket.js';
import { registerWerewolfSockets } from './werewolf/socket.js';
import { registerGomokuSockets } from './gomoku/socket.js';
import { registerGoSockets } from './go/socket.js';
import { registerChessSockets } from './chess/socket.js';
import { registerScriptMurderSockets } from './script-murder/socket.js';
import { registerDwarfMineSockets } from './dwarf-mine/socket.js';
import { registerChineseChessSockets } from './chinese-chess/socket.js';
import { registerGoldMinerSockets } from './gold-miner/socket.js';
import { registerAvalonSockets } from './avalon/socket.js';
import { registerLifeboatSockets } from './lifeboat/socket.js';
import type { GameSocketDeps } from './undercover/socket.js';
import { wrapSocketForGameHandlers } from './handler-utils.js';

export type { GameSocketDeps };

export function registerAllGameSockets(
  socket: Socket,
  deps: GameSocketDeps & { io?: import('socket.io').Server },
) {
  const safeSocket = wrapSocketForGameHandlers(socket, deps);
  registerUndercoverSockets(safeSocket, deps);
  registerDaVinciSockets(safeSocket, deps);
  registerDrawGuessSockets(safeSocket, deps);
  registerActGuessSockets(safeSocket, deps);
  registerHeartAttackSockets(safeSocket, deps);
  registerWerewolfSockets(safeSocket, deps);
  registerGomokuSockets(safeSocket, deps);
  registerGoSockets(safeSocket, deps);
  registerChessSockets(safeSocket, deps);
  registerScriptMurderSockets(safeSocket, deps);
  registerDwarfMineSockets(safeSocket, deps);
  registerChineseChessSockets(safeSocket, deps);
  registerGoldMinerSockets(safeSocket, deps);
  registerLifeboatSockets(safeSocket, deps);
  registerAvalonSockets(safeSocket, deps);
}
