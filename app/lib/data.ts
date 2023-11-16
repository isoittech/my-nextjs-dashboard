import { Prisma, PrismaClient } from "@prisma/client";
import {
  // CustomerField,
  // CustomersTable,
  // InvoiceForm,
  // InvoicesTable,
  // LatestInvoiceRaw,
  User,
  Revenue,
  LatestInvoice,
  LatestInvoiceRaw,
  InvoiceForm,
} from "./definitions";
import { formatCurrency } from "./utils";
import { invoices } from "./placeholder-data";
import { unstable_noStore as noStore } from "next/cache";

export const prisma = new PrismaClient();

export async function getUser(email: string) {
  try {
    noStore();

    // Prisma Clientを使ってユーザーを取得
    const user = await prisma.users.findUnique({
      where: {
        email: email,
      },
    });

    return user;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    throw new Error("Failed to fetch user.");
  }
}

export async function fetchRevenue() {
  try {
    noStore();

    console.log("Fetching revenue data...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await prisma.revenue.findMany();

    console.log("Data fetch complete after 3 seconds.");

    return data;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices(): Promise<LatestInvoice[]> {
  try {
    noStore();

    console.log("Fetching latest invoices data...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const latestInvoices = await prisma.invoices.findMany({
      take: 5,
      orderBy: {
        date: "desc",
      },
      include: {
        customer: {
          select: {
            name: true,
            image_url: true,
            email: true,
          },
        },
      },
    });

    console.log("Data fetch complete after 2 seconds.");

    const resultlatestInvoices = latestInvoices.map((invoice) => ({
      ...invoice,
      ...invoice.customer,
      amount: formatCurrency(invoice.amount),
    }));

    return resultlatestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    noStore();
    // 複数のクエリを並行して初期化
    const invoiceCountPromise = prisma.invoices.count();
    const customerCountPromise = prisma.customers.count();
    const invoiceStatusPromisePaid = prisma.invoices.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: "paid",
      },
    });

    const invoiceStatusPromisePending = prisma.invoices.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: "pending",
      },
    });

    // Promise.allで同時に実行
    const [
      numberOfInvoices,
      numberOfCustomers,
      invoiceStatusPaid,
      invoiceStatusPending,
    ] = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromisePaid,
      invoiceStatusPromisePending,
    ]);

    // 結果の整形
    const totalPaidInvoices = formatCurrency(
      invoiceStatusPaid._sum.amount ?? 0
    );
    const totalPendingInvoices = formatCurrency(
      invoiceStatusPending._sum.amount ?? 0
    );

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    noStore();
    const invoices = await prisma.invoices.findMany({
      where: {
        OR: [
          {
            customer: {
              name: {
                contains: query,
                mode: "insensitive", // ILIKEに相当
              },
            },
          },
          {
            customer: {
              email: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          // {
          //   // 数値と日付のフィルタリングはPrismaでは直接サポートされていません。
          //   // これらの条件を適用するには、アプリケーションロジックでの事前処理か、
          //   // データベースビュー、ストアドプロシージャを使用するなどの方法が考えられます。
          // },
          {
            status: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      orderBy: {
        date: "desc",
      },
      skip: offset,
      take: ITEMS_PER_PAGE,
      include: {
        customer: true, // 関連する顧客情報を含める
      },
    });

    return invoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    noStore();
    // 条件に一致する請求書の総数をカウント
    const count = await prisma.invoices.count({
      where: {
        OR: [
          {
            customer: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            customer: {
              email: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          // 数値と日付のフィルタリングはPrismaでは直接サポートされていません。
          // これらの条件を適用するには、アプリケーションロジックでの事前処理か、
          // データベースビュー、ストアドプロシージャを使用するなどの方法が考えられます。
          {
            status: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
    });

    // 総ページ数を計算
    const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    noStore();
    // IDに基づいて単一の請求書を検索
    const invoice = await prisma.invoices.findUnique({
      where: {
        id: id,
      },
    });

    if (invoice) {
      // 金額をセントからドルに変換
      return {
        ...invoice,
        amount: invoice.amount / 100,
      } as InvoiceForm;
    } 
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error(`Failed to fetch invoice with id ${id}.`);
  }
}

export async function fetchCustomers() {
  try {
    noStore();
    // すべての顧客を取得し、名前で昇順に並べる
    const customers = await prisma.customers.findMany({
      orderBy: {
        name: "asc",
      },
    });

    // const result = await prisma.$queryRaw(
    //   Prisma.sql`SELECT * FROM "Customers" order by name`
    // );
    // console.log(`★result: ${JSON.stringify(result, null, 2)}`);

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

async function main() {
  const getUserResult = await getUser("user@nextmail.com");
  console.log(`getUserResult: ${JSON.stringify(getUserResult)}`);
  const fetchRevenueResult = await fetchRevenue();
  console.log(`fetchRevenueResult: ${JSON.stringify(fetchRevenueResult)}`);
  const fetchLatestInvoicesResult = await fetchLatestInvoices();
  console.log(
    `fetchLatestInvoicesResult: ${JSON.stringify(
      fetchLatestInvoicesResult,
      null,
      2
    )}`
  );
  const fetchCardDataResult = await fetchCardData();
  console.log(
    `fetchCardDataResult: ${JSON.stringify(fetchCardDataResult, null, 2)}`
  );
  const fetchFilteredInvoicesResult = await fetchFilteredInvoices("ste", 1);
  console.log(
    `fetchFilteredInvoicesResult: ${JSON.stringify(
      fetchFilteredInvoicesResult,
      null,
      2
    )}`
  );
  const fetchInvoicesPagesResult = await fetchInvoicesPages("ste");
  console.log(
    `fetchInvoicesPagesResult: ${JSON.stringify(
      fetchInvoicesPagesResult,
      null,
      2
    )}`
  );
  const fetchInvoiceByIdResult = await fetchInvoiceById(
    "65e92993-572e-4c5f-8235-c3275789fbe5"
  );
  console.log(
    `fetchInvoiceByIdResult: ${JSON.stringify(fetchInvoiceByIdResult, null, 2)}`
  );
  const fetchCustomersResult = await fetchCustomers();
  console.log(
    `fetchCustomersResult: ${JSON.stringify(fetchCustomersResult, null, 2)}`
  );
}

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
