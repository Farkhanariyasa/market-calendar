import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@cal-bot/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

async function isAuthorized(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === process.env.NEXTAUTH_SECRET) {
      return true;
    }
  }

  const session = await getServerSession(authOptions);
  if (session && (session.user as any).discordId) {
    return true;
  }
  return false;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    
    // Only update allowed fields for Drag and Drop
    const updateData: any = {};
    if (body.startTime) updateData.startTime = new Date(body.startTime);
    if (body.endTime) updateData.endTime = new Date(body.endTime);

    const event = await prisma.event.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(event, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update event" }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    await prisma.event.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500, headers: corsHeaders });
  }
}
