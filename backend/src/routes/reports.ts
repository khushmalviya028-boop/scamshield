import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database';
import { validate } from '../middleware/validate';
import { ReportSchema, ReportInput } from '../lib/schemas';

const router = Router();

/**
 * POST /api/reports
 * Create a new community report.
 */
router.post('/', validate(ReportSchema), (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packageId, appName, reportType, description } = req.body as ReportInput;

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO community_reports (id, package_id, app_name, report_type, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, packageId ?? null, appName.trim(), reportType, description ?? null, createdAt);

    return res.status(201).json({ success: true, id });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/reports/count/:packageId
 * Return the number of community reports for a given packageId.
 */
router.get('/count/:packageId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packageId } = req.params;

    if (!packageId || !packageId.trim()) {
      res.status(400).json({ success: false, error: 'packageId param is required.' });
      return;
    }

    const row = db
      .prepare('SELECT COUNT(*) as count FROM community_reports WHERE package_id = ?')
      .get(packageId) as { count: number };

    return res.json({ count: row.count });
  } catch (err) {
    return next(err);
  }
});

export default router;
