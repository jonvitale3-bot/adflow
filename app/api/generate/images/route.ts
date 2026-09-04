import { z } from "zod";

import { generateImage, ImageGenerationError, MAX_IMAGES } from "@/lib/generation/images/generate";
import { bankFor, selectScenes } from "@/lib/generation/images/scenes";
import { DEFAULT_CAMERA_REGISTER } from "@/lib/generation/images/camera";
import { createClient } from "@/lib/supabase/server";

// A batch of 12 runs ~150s. Confirm the ceiling for the Vercel plan in use.
export const maxDuration = 300;

const BodySchema = z.object({
  clientId: z.string().uuid(),
  count: z.number().int().min(1).max(MAX_IMAGES).default(3),
  scene: z.string().optional(),
  headline: z.string().optional(),
  camera: z.enum(["phone", "dslr", "unspecified"]).optional(),
});

/** How many images to have in flight at once. */
const CONCURRENCY = 4;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { clientId, count, scene, headline, camera } = parsed.data;

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, name, industry, marine_business_type, marine_business_types, market_name, location_description, boating_style, environment_style, business_type_description, tone_keywords",
    )
    .eq("id", clientId)
    .single();

  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

  const bank = bankFor(client.industry, client.marine_business_types);
  const scenes = bank
    ? selectScenes(bank, scene, count)
    : Array.from({ length: count }, () => ({ id: "", text: "" }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      // Every enqueue is guarded: a batch can outlive the client connection,
      // and enqueueing to a closed controller throws and kills the run.
      const send = (event: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };

      send({ type: "start", total: count });

      // Long generations produce no bytes for minutes, and an idle connection
      // gets closed by the platform. A heartbeat keeps it open.
      const heartbeat = setInterval(() => send({ type: "heartbeat", t: Date.now() }), 10_000);

      let completed = 0;
      const saved: string[] = [];

      async function runOne(position: number) {
        const sceneChoice = scenes[position]!;
        try {
          const image = await generateImage(
            {
              clientName: client!.name,
              industry: client!.industry,
              marineBusinessType: client!.marine_business_type,
              marketName: client!.market_name,
              locationDescription: client!.location_description,
              boatingStyle: client!.boating_style,
              environmentStyle: client!.environment_style,
              businessTypeDescription: client!.business_type_description,
              toneKeywords: client!.tone_keywords,
              sceneText: sceneChoice.text || null,
              headline: headline ?? null,
              camera: camera ?? DEFAULT_CAMERA_REGISTER,
              sceneId: sceneChoice.id || null,
            },
            position + 1,
          );

          const path = `${clientId}/generated/${Date.now()}-${position}-${crypto.randomUUID()}.png`;
          const bytes = Buffer.from(image.base64, "base64");

          const { error: uploadError } = await supabase.storage
            .from("creatives")
            .upload(path, bytes, { contentType: "image/png", upsert: false });
          if (uploadError) throw new Error(uploadError.message);

          const {
            data: { publicUrl },
          } = supabase.storage.from("creatives").getPublicUrl(path);

          // The rendered prompt is stored on the row, so it is always possible
          // to tell which prompt produced which image. Previously the prompt
          // existed only in function logs.
          const { data: row, error: insertError } = await supabase
            .from("creatives")
            .insert({
              client_id: clientId,
              storage_path: path,
              image_url: publicUrl,
              source: "ai",
              scene: sceneChoice.id || null,
              rendered_prompt: image.prompt,
              // The image prompt forbids text, logos, buttons and colour bars
              // outright, so a generated image is a clean photograph and Meta
              // may reframe it per placement without cutting anything.
              has_baked_text: false,
            })
            .select("id")
            .single();
          if (insertError) throw new Error(insertError.message);

          saved.push(row.id);
          send({ type: "image", index: position + 1, id: row.id, url: publicUrl, scene: sceneChoice.id });
        } catch (err) {
          // One failure must not take the batch down; report it and continue.
          const message =
            err instanceof ImageGenerationError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Image generation failed";
          send({ type: "error", index: position + 1, message });
        } finally {
          completed += 1;
          send({ type: "progress", completed, total: count });
        }
      }

      try {
        // Bounded concurrency: all 12 at once reliably trips rate limits.
        const queue = Array.from({ length: count }, (_, i) => i);
        const workers = Array.from({ length: Math.min(CONCURRENCY, count) }, async () => {
          for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
            await runOne(next);
          }
        });
        await Promise.all(workers);
      } finally {
        clearInterval(heartbeat);
        send({ type: "done", saved });
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed by the client */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      // Streaming through a proxy that buffers defeats the point.
      "x-accel-buffering": "no",
    },
  });
}
