import { NextResponse } from "next/server";
import { createTrip } from "@/lib/repository";
import { createTripSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = createTripSchema.parse(await request.json());
    const result = await createTrip(input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de créer le voyage";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

