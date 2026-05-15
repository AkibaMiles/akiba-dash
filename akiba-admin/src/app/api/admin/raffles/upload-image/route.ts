import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const BUCKET = process.env.RAFFLE_IMAGE_BUCKET || "raffle-images";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  const roundId = Number(formData.get("roundId"));

  if (!Number.isInteger(roundId) || roundId <= 0) {
    return NextResponse.json({ error: "roundId is required" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const ext = extensionFor(file);
  const path = `raffles/${roundId}/${Date.now()}-${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("raffle image upload error", error);
    return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ publicUrl: data.publicUrl, path, bucket: BUCKET });
}
