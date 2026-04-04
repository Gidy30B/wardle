import { Request } from 'express';

export type RequestUser = {
  id: string;
  clerkId: string;
  email?: string;
};

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
