import { PrismaClient, SystemRoleName, MembershipStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Canonical permissions following the resource:action naming convention.
 */
export const CANONICAL_PERMISSIONS = [
  // Workspace management
  {
    action: 'workspace:read',
    category: 'workspace',
    description: 'View workspace settings and details',
  },
  {
    action: 'workspace:update',
    category: 'workspace',
    description: 'Update workspace configurations',
  },
  { action: 'workspace:delete', category: 'workspace', description: 'Delete or archive workspace' },

  // User and membership management
  { action: 'user:read', category: 'user', description: 'View team members and profiles' },
  { action: 'user:invite', category: 'user', description: 'Invite new members to the workspace' },
  {
    action: 'user:manage',
    category: 'user',
    description: 'Manage member roles, permissions, and status',
  },

  // Role and access control
  { action: 'role:read', category: 'role', description: 'View workspace roles and permissions' },
  {
    action: 'role:manage',
    category: 'role',
    description: 'Create and edit custom workspace roles',
  },

  // Conversations and inbox
  {
    action: 'conversation:read',
    category: 'conversation',
    description: 'Read customer conversations and history',
  },
  {
    action: 'conversation:write',
    category: 'conversation',
    description: 'Reply, assign, and update conversation state',
  },
  {
    action: 'conversation:assign',
    category: 'conversation',
    description: 'Assign conversation to agents or teams',
  },
  {
    action: 'conversation:close',
    category: 'conversation',
    description: 'Resolve and close customer conversations',
  },

  // Messages
  {
    action: 'message:read',
    category: 'message',
    description: 'View message details and attachments',
  },
  {
    action: 'message:send',
    category: 'message',
    description: 'Send outbound omnichannel messages',
  },
  { action: 'message:delete', category: 'message', description: 'Delete or recall messages' },

  // Contacts and CRM
  {
    action: 'contact:read',
    category: 'contact',
    description: 'View customer contacts and profiles',
  },
  {
    action: 'contact:write',
    category: 'contact',
    description: 'Create and update customer contacts',
  },
  { action: 'contact:delete', category: 'contact', description: 'Delete customer contacts' },

  // Campaigns and broadcasts
  {
    action: 'campaign:read',
    category: 'campaign',
    description: 'View broadcast campaigns and analytics',
  },
  {
    action: 'campaign:write',
    category: 'campaign',
    description: 'Create and schedule broadcast campaigns',
  },
  { action: 'campaign:launch', category: 'campaign', description: 'Trigger broadcast execution' },

  // Analytics and reporting
  {
    action: 'analytics:read',
    category: 'analytics',
    description: 'View operational dashboards and KPI reports',
  },
  {
    action: 'analytics:export',
    category: 'analytics',
    description: 'Export raw analytical and audit datasets',
  },

  // Channels and integrations
  {
    action: 'integration:read',
    category: 'integration',
    description: 'View connected channels and provider accounts',
  },
  {
    action: 'integration:manage',
    category: 'integration',
    description: 'Configure API keys, webhooks, and channel providers',
  },

  // Audit logs
  {
    action: 'audit:read',
    category: 'audit',
    description: 'View compliance and security audit logs',
  },
] as const;

/**
 * Role to permission mapping defining least-privilege defaults.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleName, string[]> = {
  [SystemRoleName.SUPER_ADMIN]: CANONICAL_PERMISSIONS.map((p) => p.action),
  [SystemRoleName.ADMIN]: [
    'workspace:read',
    'workspace:update',
    'user:read',
    'user:invite',
    'user:manage',
    'role:read',
    'conversation:read',
    'conversation:write',
    'conversation:assign',
    'conversation:close',
    'message:read',
    'message:send',
    'contact:read',
    'contact:write',
    'campaign:read',
    'campaign:write',
    'campaign:launch',
    'analytics:read',
    'analytics:export',
    'integration:read',
    'integration:manage',
    'audit:read',
  ],
  [SystemRoleName.AGENT]: [
    'workspace:read',
    'user:read',
    'conversation:read',
    'conversation:write',
    'conversation:assign',
    'conversation:close',
    'message:read',
    'message:send',
    'contact:read',
    'contact:write',
    'campaign:read',
    'analytics:read',
  ],
  [SystemRoleName.AI_BOT]: [
    'workspace:read',
    'conversation:read',
    'conversation:write',
    'conversation:assign',
    'message:read',
    'message:send',
    'contact:read',
  ],
};

async function main() {
  console.info('🌱 Starting VYNOR database seeding...');

  // 1. Seed canonical permissions
  console.info('Seeding canonical permissions...');
  for (const perm of CANONICAL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { action: perm.action },
      update: {
        description: perm.description,
        category: perm.category,
      },
      create: {
        action: perm.action,
        description: perm.description,
        category: perm.category,
      },
    });
  }

  // 2. Seed system roles
  console.info('Seeding system roles...');
  const systemRoleDescriptions: Record<SystemRoleName, string> = {
    [SystemRoleName.SUPER_ADMIN]: 'Full system access and tenant governance',
    [SystemRoleName.ADMIN]: 'Operational administrator with management permissions',
    [SystemRoleName.AGENT]: 'Customer service agent with conversation and inbox access',
    [SystemRoleName.AI_BOT]:
      'Automated agent service account for AI processing and message delivery',
  };

  const roleMap = new Map<string, string>();

  for (const roleName of Object.values(SystemRoleName)) {
    // System roles have workspaceId = null
    const existing = await prisma.role.findFirst({
      where: {
        workspaceId: null,
        name: roleName,
      },
    });

    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: {
            description: systemRoleDescriptions[roleName],
            isSystem: true,
          },
        })
      : await prisma.role.create({
          data: {
            workspaceId: null,
            name: roleName,
            description: systemRoleDescriptions[roleName],
            isSystem: true,
          },
        });

    roleMap.set(roleName, role.id);

    // Link permissions to role
    const actions = DEFAULT_ROLE_PERMISSIONS[roleName];
    const permissions = await prisma.permission.findMany({
      where: { action: { in: actions } },
    });

    for (const p of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: p.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: p.id,
        },
      });
    }
  }

  // 3. Seed development workspace
  console.info('Seeding development workspace...');
  const devWorkspace = await prisma.workspace.upsert({
    where: { slug: 'vynor-dev' },
    update: {
      name: 'VYNOR Development Workspace',
      timezone: 'Asia/Jakarta',
    },
    create: {
      name: 'VYNOR Development Workspace',
      slug: 'vynor-dev',
      timezone: 'Asia/Jakarta',
    },
  });

  // 4. Seed development users
  console.info('Seeding development users...');
  const adminUser = await prisma.userProfile.upsert({
    where: { email: 'admin@vynor.local' },
    update: {
      displayName: 'Dev Administrator',
      supabaseAuthId: 'dev_user_admin_001',
    },
    create: {
      email: 'admin@vynor.local',
      displayName: 'Dev Administrator',
      supabaseAuthId: 'dev_user_admin_001',
    },
  });

  const agentUser = await prisma.userProfile.upsert({
    where: { email: 'agent@vynor.local' },
    update: {
      displayName: 'Dev Agent',
      supabaseAuthId: 'dev_user_agent_001',
    },
    create: {
      email: 'agent@vynor.local',
      displayName: 'Dev Agent',
      supabaseAuthId: 'dev_user_agent_001',
    },
  });

  // 5. Seed memberships and role assignments
  console.info('Seeding workspace memberships and role assignments...');
  const adminMembership = await prisma.workspaceMembership.upsert({
    where: {
      workspaceId_userProfileId: {
        workspaceId: devWorkspace.id,
        userProfileId: adminUser.id,
      },
    },
    update: {
      status: MembershipStatus.ACTIVE,
    },
    create: {
      workspaceId: devWorkspace.id,
      userProfileId: adminUser.id,
      status: MembershipStatus.ACTIVE,
    },
  });

  const agentMembership = await prisma.workspaceMembership.upsert({
    where: {
      workspaceId_userProfileId: {
        workspaceId: devWorkspace.id,
        userProfileId: agentUser.id,
      },
    },
    update: {
      status: MembershipStatus.ACTIVE,
    },
    create: {
      workspaceId: devWorkspace.id,
      userProfileId: agentUser.id,
      status: MembershipStatus.ACTIVE,
    },
  });

  const superAdminRoleId = roleMap.get(SystemRoleName.SUPER_ADMIN);
  if (superAdminRoleId) {
    await prisma.membershipRole.upsert({
      where: {
        membershipId_roleId: {
          membershipId: adminMembership.id,
          roleId: superAdminRoleId,
        },
      },
      update: {},
      create: {
        membershipId: adminMembership.id,
        roleId: superAdminRoleId,
      },
    });
  }

  const agentRoleId = roleMap.get(SystemRoleName.AGENT);
  if (agentRoleId) {
    await prisma.membershipRole.upsert({
      where: {
        membershipId_roleId: {
          membershipId: agentMembership.id,
          roleId: agentRoleId,
        },
      },
      update: {},
      create: {
        membershipId: agentMembership.id,
        roleId: agentRoleId,
      },
    });
  }

  console.info('✅ Database seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Database seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
