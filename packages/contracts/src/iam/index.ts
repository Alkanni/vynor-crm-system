export {
  CANONICAL_PERMISSIONS,
  PermissionActionSchema,
  PermissionCategorySchema,
  hasPermission,
  hasAllPermissions,
  isPermissionAction,
  type CanonicalPermissionDefinition,
  type PermissionAction,
  type PermissionCategory,
} from './permissions.js';

export {
  ActorContextSchema,
  ActorMembershipSchema,
  ActorTeamSchema,
  ActorUserSchema,
  ActorWorkspaceSchema,
  type ActorContext,
  type ActorMembership,
  type ActorTeam,
  type ActorUser,
  type ActorWorkspace,
} from './actor.js';

export {
  IAM_ERROR_DEFINITIONS,
  IamErrorCodeSchema,
  IamErrorResponseSchema,
  type IamErrorCode,
  type IamErrorResponse,
} from './errors.js';
