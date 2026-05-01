import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  let tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'BZ Telecom',
        slug: 'bz-telecom',
        runtimeConfigPath: 'runtime/tenants/bz-telecom/voicebot-config.json',
        isActive: true,
        notes: 'Client par défaut créé pendant la migration multi-tenant.',
      },
    });
  }

  await prisma.prompt.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  await prisma.context.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  await prisma.routeRule.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  await prisma.flow.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  await prisma.directoryContact.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  await prisma.setting.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  await prisma.bookingService.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  await prisma.calendarConnection.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  await prisma.calendarResource.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });

  console.log('Default tenant: ' + tenant.id + ' (' + tenant.slug + ')');
}

main().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
