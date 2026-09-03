import { cameraBlock, DEFAULT_CAMERA_REGISTER, type CameraRegister } from "./camera.ts";
import {
  ANATOMY_CONSTRAINTS,
  COMPOSITION_CONSTRAINTS,
  JUMPING_CONSTRAINTS,
  REALISM_CONSTRAINTS,
} from "./realism.ts";

/**
 * Image prompt assembly.
 *
 * The live master prompt was already clear that the output is a photograph
 * only, with brand chrome composited afterwards — the spec's claim that it
 * baked in typography and a CTA button was wrong. That instruction is kept and
 * strengthened; what changes is the photographic register and removing the
 * Carefree-specific parts so every industry gets the same quality bar.
 */

export interface ImagePromptInput {
  clientName: string;
  industry: string;
  marineBusinessType?: string | null;
  marketName?: string | null;
  locationDescription?: string | null;
  boatingStyle?: string | null;
  environmentStyle?: string | null;
  businessTypeDescription?: string | null;
  toneKeywords?: string | null;
  sceneText?: string | null;
  headline?: string | null;
  camera?: CameraRegister;
}

const NO_CHROME = `CRITICAL: This is a PHOTOGRAPH ONLY. The brand chrome (headline, logo, call-to-action strip, buttons, benefit icons, microcopy) is composited on top of this photo in code afterward. Therefore:
- DO NOT render any text, words, letters, numbers, or typography anywhere in the image
- DO NOT render any logo, wordmark, or brand graphic
- DO NOT render any button, call-to-action, banner, or UI element
- DO NOT render any icons
- DO NOT render any coloured bars, strips, or solid blocks of colour across the bottom or top
- Output a clean, full-bleed photograph and NOTHING else`;

const AVOID = `Avoid: any text or letters in the image, fake logos, fake buttons, fake icons, fake CTA bars, AI anatomy errors, duplicated limbs, mangled hands, overly crowded scenes, exaggerated facial expressions, cheesy stock-photo energy, and anything that reads as an advertisement rather than a photograph.`;

function marketClause(input: ImagePromptInput): string {
  const place = input.marketName || input.locationDescription;
  return place ? ` in ${place}` : "";
}

export function buildImagePrompt(input: ImagePromptInput): string {
  const camera = cameraBlock(input.camera ?? DEFAULT_CAMERA_REGISTER);
  const isBoatClub = input.industry === "boat_club";
  const parts: string[] = [];

  if (isBoatClub) {
    parts.push(
      `Create a lifestyle photograph for a Meta ad for ${input.clientName}, a membership boat club${marketClause(input)}.`,
    );
  } else if (input.industry === "marina") {
    parts.push(
      `Create a photograph for a Meta ad for ${input.clientName}, a marina${marketClause(input)}.`,
    );
  } else {
    parts.push(
      `Create a photograph for a Meta ad for ${input.clientName}${marketClause(input)}.`,
    );
    if (input.businessTypeDescription) {
      parts.push(`Business: ${input.businessTypeDescription}`);
    }
    if (input.toneKeywords) {
      parts.push(`Mood / tone: ${input.toneKeywords}`);
    }
  }

  parts.push("", NO_CHROME, "", camera);

  if (isBoatClub && input.boatingStyle) {
    parts.push("", `Boating style for this market: ${input.boatingStyle}`);
  }
  if (input.environmentStyle) {
    parts.push(`Environment: ${input.environmentStyle}`);
  }

  if (input.sceneText) {
    parts.push(
      "",
      "SCENE FOCUS FOR THIS IMAGE (this is the primary activity to depict — make it the centrepiece of the scene):",
      input.sceneText,
    );
  }

  parts.push("", AVOID);

  if (input.headline) {
    // Passed for context only. The old prompt made this mistake-proof by
    // saying so explicitly, and it is worth keeping.
    parts.push(
      "",
      `The headline this image will be paired with is "${input.headline}". It is provided for context ONLY — do NOT render it in the image.`,
    );
  }

  let prompt = parts.join("\n");

  prompt += ANATOMY_CONSTRAINTS;
  if (isBoatClub) prompt += JUMPING_CONSTRAINTS;
  prompt += COMPOSITION_CONSTRAINTS;
  prompt += REALISM_CONSTRAINTS;

  return prompt;
}
