import { NextResponse } from "next/server";
import { getTrip, mutateTrip } from "@/lib/repository";
import { tripActionSchema } from "@/lib/validation";

type Context = { params: Promise<{ token: string }> };

export async function GET(_: Request, context: Context) {
  try {
    const { token } = await context.params;
    return NextResponse.json(await getTrip(token));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voyage introuvable" }, { status: 404 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { token } = await context.params;
    const action = tripActionSchema.parse(await request.json());
    return NextResponse.json(await mutateTrip(token, action));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Modification impossible" }, { status: 400 });
  }
}

