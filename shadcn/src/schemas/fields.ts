import { initOptionsSchema } from "./init.schemas"

// Shared field for including initOptions in any schema
export const initOptionsField = {
  initOptions: initOptionsSchema.optional(),
} 