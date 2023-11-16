import {
  users,
  customers,
  invoices,
  revenue,
} from "@/app/lib/placeholder-data";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ユーザーのシード
  for (const user of users) {
    const hashedPassword = await hash(user.password, 10);
    await prisma.users.upsert({
      where: { email: user.email },
      update: {},
      create: {
        id:user.id,
        name: user.name,
        email: user.email,
        password: hashedPassword,
      },
    });
  }

  // 顧客のシード
  for (const customer of customers) {
    await prisma.customers.upsert({
      where: { email: customer.email },
      update: {},
      create: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        image_url: customer.image_url,
      },
    });
  }

  // 請求書のシード
  for (const invoice of invoices) {
    await prisma.invoices.create({
      data: {
        customer: {
          connect: { id: invoice.customer_id },
        },
        amount: invoice.amount,
        status: invoice.status,
        date: new Date(invoice.date),
      },
    });
  }

  // 収益のシード
  for (const rev of revenue) {
    await prisma.revenue.upsert({
      where: { month: rev.month },
      update: {},
      create: {
        month: rev.month,
        revenue: rev.revenue,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
