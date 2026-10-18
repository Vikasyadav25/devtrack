import type { Env } from './auth';
export type AppContext = { Bindings: Env; Variables: { user: string; email: string } };
