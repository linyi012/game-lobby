import { Router } from 'express';
import { z } from 'zod';
import type { Database } from '@game-lobby/db';
import { murderScriptContentSchema } from '@game-lobby/script-murder-scripts';
import type { AuthRequest } from '../middleware/auth.js';
import {
  createUserScript,
  deleteUserScript,
  getScriptById,
  listOfficialScripts,
  listPlayableScripts,
  listUserScripts,
  updateUserScript,
} from '../services/script-murder-service.js';

const scriptBodySchema = z.object({
  title: z.string().min(1).max(128),
  description: z.string().max(512).default(''),
  minPlayers: z.number().int().min(1).max(8),
  maxPlayers: z.number().int().min(1).max(8),
  content: murderScriptContentSchema,
});

export function scriptMurderScriptsRouter(db: Database): Router {
  const router = Router();

  router.get('/mine', async (req, res) => {
    const user = (req as AuthRequest).user!;
    const scripts = await listUserScripts(db, user.id);
    res.json(scripts);
  });

  router.get('/official', async (_req, res) => {
    const scripts = await listOfficialScripts(db);
    res.json(scripts);
  });

  router.get('/playable', async (req, res) => {
    const user = (req as AuthRequest).user!;
    const scripts = await listPlayableScripts(db, user.id);
    res.json(scripts);
  });

  router.get('/:id', async (req, res) => {
    const user = (req as AuthRequest).user!;
    const script = await getScriptById(db, req.params.id!, user.id);
    if (!script) {
      res.status(404).json({ message: '剧本不存在' });
      return;
    }
    res.json(script);
  });

  router.post('/', async (req, res) => {
    const parsed = scriptBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效', errors: parsed.error.issues });
      return;
    }
    const user = (req as AuthRequest).user!;
    const result = await createUserScript(db, user.id, parsed.data);
    if ('error' in result) {
      res.status(400).json({ message: result.error });
      return;
    }
    res.status(201).json(result);
  });

  router.patch('/:id', async (req, res) => {
    const parsed = scriptBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }
    const user = (req as AuthRequest).user!;
    const result = await updateUserScript(db, user.id, req.params.id!, parsed.data);
    if (result === null) {
      res.status(404).json({ message: '剧本不存在' });
      return;
    }
    if ('error' in result) {
      res.status(400).json({ message: result.error });
      return;
    }
    res.json(result);
  });

  router.delete('/:id', async (req, res) => {
    const user = (req as AuthRequest).user!;
    const ok = await deleteUserScript(db, user.id, req.params.id!);
    if (!ok) {
      res.status(404).json({ message: '剧本不存在' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
