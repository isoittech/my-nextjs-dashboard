"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "./data";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a customer.",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Please enter an amount greater than $0." }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status.",
  }),
  date: z.string(),
});

// Use Zod to update the expected types
const CreateInvoice = InvoiceSchema.omit({ id: true, date: true });
// Use Zod to update the expected types
const UpdateInvoice = InvoiceSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  // safeParse()は、成功フィールドかエラーフィールドを含むオブジェクトを返します。これにより、try/catchブロックの中にこのロジックを置くことなく、より優雅にバリデーションを処理することができます。
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Create Invoice.",
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  //   const date = new Date().toISOString().split("T")[0];

  try {
    await prisma.invoices.create({
      data: {
        customer_id: customerId,
        amount: amountInCents,
        status,
        date: new Date().toISOString(),
      },
    });
  } catch (error) {
    // If a database error occurs, return a more specific error.
    return {
      message: "Database Error: Failed to Create Invoice.",
    };
  }
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData
) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Update Invoice.",
    };
  }
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  //   await sql`
  // 	  UPDATE invoices
  // 	  SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
  // 	  WHERE id = ${id}
  // 	`;

  try {
    await prisma.invoices.update({
      where: {
        id,
      },
      data: {
        customer_id: customerId,
        amount: amountInCents,
        status,
      },
    });
  } catch (error) {
    return { message: "Database Error: Failed to Update Invoice." };
  }
  //   Calling revalidatePath to clear the client cache and make a new server request.
  revalidatePath("/dashboard/invoices");
  //   Calling redirect to redirect the user to the invoice's page.
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  //   throw new Error("Failed to Delete Invoice");
  try {
    //   await sql`DELETE FROM invoices WHERE id = ${id}`;

    await prisma.invoices.delete({
      where: {
        id,
      },
    });
    revalidatePath("/dashboard/invoices");
    return { message: "Deleted Invoice." };
  } catch (error) {
    return { message: "Database Error: Failed to Delete Invoice." };
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", Object.fromEntries(formData));
  } catch (error) {
    if ((error as Error).message.includes("CredentialsSignin")) {
      return "CredentialSignin";
    }
    throw error;
  }
}
