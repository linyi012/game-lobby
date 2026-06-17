import { Router } from 'express';
import { z } from 'zod';
import type { Database } from '@game-lobby/db';
import type { AuthRequest } from '../middleware/auth.js';
import {
  createUserPack,
  deleteUserPack,
  getSyncStatus,
  listCategories,
  listUserPacks,
  syncOfficialWordPacks,
  updateUserPack,
} from '../services/word-pack-service.js';

const createPackSchema = z.object({
  name: z.string().min(1).max(64),
  words: z.array(z.string().min(1).max(32)),
});

const updatePackSchema = z.object({
  name: z.string().min(1).max(64),
  words: z.array(z.string().min(1).max(32)),
});

export function wordPacksRouter(db: Database): Router {
  const router = Router();

  router.get('/categories', async (_req, res) => {
    const categories = await listCategories(db);
    res.json(categories);
  });

  router.get('/mine', async (req, res) => {
    const user = (req as AuthRequest).user!;
    const packs = await listUserPacks(db, user.id);
    res.json(packs);
  });

  router.post('/', async (req, res) => {
    const parsed = createPackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }
    const user = (req as AuthRequest).user!;
    const pack = await createUserPack(db, user.id, parsed.data.name, parsed.data.words);
    res.status(201).json(pack);
  });

  router.patch('/:id', async (req, res) => {
    const parsed = updatePackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }
    const user = (req as AuthRequest).user!;
    const pack = await updateUserPack(
      db,
      user.id,
      req.params.id!,
      parsed.data.name,
      parsed.data.words,
    );
    if (!pack) {
      res.status(404).json({ message: '词库不存在' });
      return;
    }
    res.json(pack);
  });

  router.delete('/:id', async (req, res) => {
    const user = (req as AuthRequest).user!;
    const ok = await deleteUserPack(db, user.id, req.params.id!);
    if (!ok) {
      res.status(404).json({ message: '词库不存在' });
      return;
    }
    res.json({ ok: true });
  });

  router.get('/sync-status', async (_req, res) => {
    const status = await getSyncStatus(db);
    res.json(status);
  });

  router.post('/sync', async (_req, res) => {
    const status = await syncOfficialWordPacks(db);
    res.json(status);
  });

  return router;
}
