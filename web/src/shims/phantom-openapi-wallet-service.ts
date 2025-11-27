// Re-export the upstream SDK but ensure KmsUserRole is available for @phantom/client
export * from '@phantom/openapi-wallet-service/dist/esm/index.js'
export { KmsUserRole } from '@phantom/openapi-wallet-service/dist/esm/model/kms-user-role.js'

// Provide a default export for completeness
import * as BaseModule from '@phantom/openapi-wallet-service/dist/esm/index.js'
export default BaseModule
