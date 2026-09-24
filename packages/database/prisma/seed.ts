import { PrismaClient, SystemRoleName, MembershipStatus } from '@prisma/client';
import { CANONICAL_PERMISSIONS } from '@vynor/contracts';

const prisma = new PrismaClient();

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
    'team:read',
    'team:manage',
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
    'team:read',
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
  console.info('Seeding canonical permissions from @vynor/contracts...');
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

  // 6. Seed workspace teams and team assignments
  console.info('Seeding workspace teams...');
  const supportTeam = await prisma.team.upsert({
    where: {
      workspaceId_name: {
        workspaceId: devWorkspace.id,
        name: 'Tier 1 Support',
      },
    },
    update: {
      description: 'Frontline customer triage and conversation handling',
    },
    create: {
      workspaceId: devWorkspace.id,
      name: 'Tier 1 Support',
      description: 'Frontline customer triage and conversation handling',
    },
  });

  await prisma.team.upsert({
    where: {
      workspaceId_name: {
        workspaceId: devWorkspace.id,
        name: 'VIP Sales & Outreach',
      },
    },
    update: {
      description: 'High-value customer account management and outbound campaigns',
    },
    create: {
      workspaceId: devWorkspace.id,
      name: 'VIP Sales & Outreach',
      description: 'High-value customer account management and outbound campaigns',
    },
  });

  // Assign agent to support team
  await prisma.teamMember.upsert({
    where: {
      teamId_membershipId: {
        teamId: supportTeam.id,
        membershipId: agentMembership.id,
      },
    },
    update: {},
    create: {
      teamId: supportTeam.id,
      membershipId: agentMembership.id,
    },
  });

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
