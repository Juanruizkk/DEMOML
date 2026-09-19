import { FastifyInstance } from 'fastify';
import { Container } from '../../composition/container.js';
import { AuthGuards } from '../middleware/auth.js';

const LEAD_RATE = { max: 5, timeWindow: '10 minutes' };

export function registerLeadRoutes(app: FastifyInstance, c: Container, guards: AuthGuards) {
  const { leadCtrl } = c;
  const { requireSuperAdmin } = guards;

  app.post('/api/leads', { config: { rateLimit: LEAD_RATE } }, leadCtrl.create);
  app.get('/api/leads', { preHandler: requireSuperAdmin }, leadCtrl.list);
  app.patch('/api/leads/:id/status', { preHandler: requireSuperAdmin }, leadCtrl.updateStatus);
}
