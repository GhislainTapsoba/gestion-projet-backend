/**
 * Role-Based Access Control (RBAC) System
 *
 * Roles:
 * - admin: Full access to everything
 * - manager: Can manage projects and teams
 * - user: Can only view and edit assigned tasks
 */

export type UserRole = 'admin' | 'manager' | 'user';

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

// Define permissions for each role
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    // Admin has all permissions
    { resource: '*', action: 'manage' }, // '*' means all resources
  ],
  manager: [
    // Projects
    { resource: 'projects', action: 'create' },
    { resource: 'projects', action: 'read' },
    { resource: 'projects', action: 'update' },
    { resource: 'projects', action: 'delete' },
    // Tasks
    { resource: 'tasks', action: 'create' },
    { resource: 'tasks', action: 'read' },
    { resource: 'tasks', action: 'update' },
    { resource: 'tasks', action: 'delete' },
    // Stages
    { resource: 'stages', action: 'create' },
    { resource: 'stages', action: 'read' },
    { resource: 'stages', action: 'update' },
    { resource: 'stages', action: 'delete' },
    // Documents
    { resource: 'documents', action: 'create' },
    { resource: 'documents', action: 'read' },
    { resource: 'documents', action: 'update' },
    { resource: 'documents', action: 'delete' },
    // Users (read only for managers)
    { resource: 'users', action: 'read' },
    // Activity logs
    { resource: 'activity-logs', action: 'read' },
  ],
  user: [
    // Projects (read only - cannot create)
    { resource: 'projects', action: 'read' },
    // Tasks (can create, read, and update)
    { resource: 'tasks', action: 'create' },
    { resource: 'tasks', action: 'read' },
    { resource: 'tasks', action: 'update' }, // Can update status of assigned tasks
    // Stages (can create, read, and update)
    { resource: 'stages', action: 'create' },
    { resource: 'stages', action: 'read' },
    { resource: 'stages', action: 'update' }, // Can update status
    // Documents (read and upload)
    { resource: 'documents', action: 'create' },
    { resource: 'documents', action: 'read' },
    // Activity logs (read only)
    { resource: 'activity-logs', action: 'read' },
  ],
};

/**
 * Check if a user has permission to perform an action on a resource
 */
export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: Permission['action']
): boolean {
  const permissions = rolePermissions[userRole];

  // Check for wildcard permission (admin)
  const hasWildcard = permissions.some(
    (p) => p.resource === '*' && (p.action === 'manage' || p.action === action)
  );

  if (hasWildcard) {
    return true;
  }

  // Check for specific permission
  return permissions.some(
    (p) => p.resource === resource && (p.action === 'manage' || p.action === action)
  );
}

/**
 * Require permission middleware helper
 * Returns error response if user doesn't have permission
 */
export function requirePermission(
  userRole: UserRole,
  resource: string,
  action: Permission['action']
): { allowed: boolean; error?: string } {
  const allowed = hasPermission(userRole, resource, action);

  if (!allowed) {
    return {
      allowed: false,
      error: `Permission denied: ${userRole} cannot ${action} ${resource}`,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can manage a specific project (is project manager or admin)
 */
export function canManageProject(
  userRole: UserRole,
  userId: string,
  projectManagerId: string | null
): boolean {
  if (userRole === 'admin') {
    return true;
  }

  if (userRole === 'manager' && projectManagerId === userId) {
    return true;
  }

  return false;
}

/**
 * Check if user can edit a specific task (is assignee, project manager, or admin)
 */
export function canEditTask(
  userRole: UserRole,
  userId: string,
  taskAssigneeId: string | null,
  projectManagerId: string | null
): boolean {
  if (userRole === 'admin') {
    return true;
  }

  if (userRole === 'manager' && projectManagerId === userId) {
    return true;
  }

  if (taskAssigneeId === userId) {
    return true;
  }

  return false;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(userRole: UserRole): Permission[] {
  return rolePermissions[userRole];
}

/**
 * Mapper le rôle stocké en base (ADMIN / PROJECT_MANAGER / EMPLOYEE)
 * vers le rôle applicatif du système de permissions
 */
export function mapDbRoleToUserRole(dbRole: string | null): UserRole {
  switch (dbRole) {
    case 'ADMIN':
      return 'admin';
    case 'PROJECT_MANAGER':
      return 'manager';
    default:
      return 'user';
  }
}

/**
 * Check if role can access admin features
 */
export function isAdmin(userRole: UserRole): boolean {
  return userRole === 'admin';
}

/**
 * Check if role can manage teams (admin or manager)
 */
export function canManageTeam(userRole: UserRole): boolean {
  return userRole === 'admin' || userRole === 'manager';
}
