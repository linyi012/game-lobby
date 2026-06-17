import { Router } from 'express';
import { z } from 'zod';
import type { Database } from '@game-lobby/db';
import type { AuthRequest } from '../middleware/auth.js';
import {
  createUserPairPack,
  deleteUserPairPack,
  getPairSyncStatus,
  listPairCategories,
  listUserPairPacks,
  syncOfficialPairPacks,
  updateUserPairPack,
} from '../services/word-pair-service.js';

const pairTupleSchema = z.tuple([
  z.string().min(1).max(32),
  z.string().min(1).max(32),
]);

const createPackSchema = z.object({
  name: z.string().min(1).max(64),
  pairs: z.array(pairTupleSchema).min(1),
});

const updatePackSchema = z.object({
  name: z.string().min(1).max(64),
  pairs: z.array(pairTupleSchema).min(1),
});

export function wordPairsRouter(db: Database): Router {
  const router = Router();

  router.get('/categories', async (_req, res) => {
    const categories = await listPairCategories(db);
    res.json(categories);
  });

  router.get('/mine', async (req, res) => {
    const user = (req as AuthRequest).user!;
    const packs = await listUserPairPacks(db, user.id);
    res.json(packs);
  });

  router.post('/', async (req, res) => {
    const parsed = createPackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }
    const user = (req as AuthRequest).user!;
    const pack = await createUserPairPack(db, user.id, parsed.data.name, parsed.data.pairs);
    res.status(201).json(pack);
  });

  router.patch('/:id', async (req, res) => {
    const parsed = updatePackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }
    const user = (req as AuthRequest).user!;
    const pack = await updateUserPairPack(
      db,
      user.id,
      req.params.id!,
      parsed.data.name,
      parsed.data.pairs,
    );
    if (!pack) {
      res.status(404).json({ message: '词对库不存在' });
      return;
    }
    res.json(pack);
  });

  router.delete('/:id', async (req, res) => {
    const user = (req as AuthRequest).user!;
    const ok = await deleteUserPairPack(db, user.id, req.params.id!);
    if (!ok) {
      res.status(404).json({ message: '词对库不存在' });
      return;
    }
    res.json({ ok: true });
  });

  router.get('/sync-status', async (_req, res) => {
    const status = await getPairSyncStatus(db);
    res.json(status);
  });

  router.post('/sync', async (_req, res) => {
    const status = await syncOfficialPairPacks(db);
    res.json(status);
  });

  return router;
}
