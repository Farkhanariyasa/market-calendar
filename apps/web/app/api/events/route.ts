import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@cal-bot/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { startTime: "asc" },
    });
    return NextResponse.json(events, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: Request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    let discordId: string | null = null;
    const body = await req.json();

    // Check authorization header first
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      if (token === process.env.NEXTAUTH_SECRET) {
        discordId = body.createdBy || "system";
      }
    }

    // Fallback to session if no token auth
    if (!discordId) {
      const session = await getServerSession(authOptions);
      if (session && (session.user as any).discordId) {
        discordId = (session.user as any).discordId;
      }
    }

    if (!discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { title, description, startTime, endTime, image, market } = body;

    const event = await prisma.event.create({
      data: {
        title,
        description,
        image,
        market: market || "US",
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdBy: discordId,
      },
    });

    return NextResponse.json(event, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500, headers: corsHeaders });
  }
}
