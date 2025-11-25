import { AuthenticatedRequest } from './auth.service';
import { Response } from 'express';

export function requireSTierHelper() {
  return (req: AuthenticatedRequest, res: Response): boolean => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'S-tier required' });
      return false;
    }
    return true;
  };
}
