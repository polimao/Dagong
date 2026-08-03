import { z } from 'zod'
import {
  ContextCompactionConfigSchema,
  DagongServeConfigSchema,
  ModelConfigSchema,
  QualityConfigSchema,
  RolesConfigSchema,
  RuntimeTuningConfigSchema,
  TokenEconomyConfigSchema
} from '../config/dagong-config.js'
import { DagongCapabilitiesConfig } from './capabilities.js'
import { HooksConfigSchema } from '../hooks/hook-config.js'

const RuntimeConfigApplyServeConfig = DagongServeConfigSchema.omit({
  host: true,
  port: true,
  dataDir: true,
  runtimeToken: true,
  insecure: true,
  storage: true
}).extend({
  tokenEconomy: TokenEconomyConfigSchema.optional()
})

export const RuntimeConfigApplyRequest = z
  .object({
    serve: RuntimeConfigApplyServeConfig.optional(),
    models: ModelConfigSchema.optional(),
    contextCompaction: ContextCompactionConfigSchema.optional(),
    runtime: RuntimeTuningConfigSchema.optional(),
    roles: RolesConfigSchema.optional(),
    capabilities: DagongCapabilitiesConfig.optional(),
    hooks: HooksConfigSchema.optional(),
    quality: QualityConfigSchema.optional()
  })
  .strict()

export const RuntimeConfigApplyResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }).strict(),
  z
    .object({
      ok: z.literal(false),
      code: z.enum(['restart_required', 'invalid_config']),
      message: z.string()
    })
    .strict()
])

export type RuntimeConfigApplyRequest = z.infer<typeof RuntimeConfigApplyRequest>
export type RuntimeConfigApplyResponse = z.infer<typeof RuntimeConfigApplyResponse>
