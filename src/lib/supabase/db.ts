import { supabase } from './client'

/**
 * Escape hatch de tipagem para a SPEC-125.
 *
 * `client.ts` é gerado pelo Skip com `createClient<Database>`, e o `types.ts` foi
 * gerado ANTES das tabelas/RPCs deste sistema (vw_showroom_publico,
 * showroom_import_pecas, showroom_* RPCs). Até o types.ts ser regenerado, os
 * acessos a esses objetos passam por aqui, sem tipagem estrita do PostgREST.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const db = supabase as unknown as {
  from: (rel: string) => any
  rpc: (fn: string, args?: Record<string, unknown>) => any
}
