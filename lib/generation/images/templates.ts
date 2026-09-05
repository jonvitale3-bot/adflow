import { cameraBlock, DEFAULT_CAMERA_REGISTER, type CameraRegister } from "./camera.ts";
import {
  ANATOMY_CONSTRAINTS,
  COMPOSITION_CONSTRAINTS,
  JUMPING_CONSTRAINTS,
  MARINE_REALISM,
  NO_CHROME,
  NOT_A_DEMONSTRATION,
  UNIVERSAL_REALISM,
} from "./realism.ts";

/**
 * Image prompt assembly.
 *
 * Ordered by what the picture actually is, because the previous order was the
 * reverse and it showed. That prompt ran to 4,251 characters, 63% of its lines
 * were prohibitions, and the first 900 characters — the span an image model
 * weights most heavily — were seven bullets of "do not render text". The scene,
 * the only part describing the photograph, did not begin until character 1,965.
 *
 * The model did exactly as instructed: not one image contained any text, and
 * not one looked like a photograph. So the scene and its framing come first
 * now, the photographic register second, and the hard rules last as a compact
 * tail. Nothing hard-won was dropped; the marine rules and the scene banks are
 * verbatim. What went is length in front of the picture.
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
  /** How this particular shot is framed, so a batch is not one shot six times. */
  framingText?: string | null;
  headline?: string | null;
  camera?: CameraRegister;
  /**
   * Whether chrome will be laid over this image afterwards. Off by default:
   * the composition rules that reserve space for it are the same rules that
   * make every image of a batch resemble every other.
   */
  reserveOverlaySpace?: boolean;
}

// The old AVOID line is gone: every clause in it was already covered. "Cheesy
// stock-photo energy" and "reads as an advertisement" are NOT_A_DEMONSTRATION
// and the camera register, "AI anatomy errors" and "crowded scenes" are the
// anatomy rules. Restating a rule does not strengthen it, it just adds length
// in front of nothing.

function marketClause(input: ImagePromptInput): string {
  const place = input.marketName || input.locationDescription;
  return place ? ` in ${place}` : "";
}

/** One line naming who this is, kept short so it cannot crowd out the scene. */
function subjectLine(input: ImagePromptInput): string {
  if (input.industry === "boat_club") {
    return `${input.clientName}, a membership boat club${marketClause(input)}.`;
  }
  if (input.industry === "marina") {
    return `${input.clientName}, a marina${marketClause(input)}.`;
  }
  return `${input.clientName}${marketClause(input)}.`;
}

export function buildImagePrompt(input: ImagePromptInput): string {
  const isBoatClub = input.industry === "boat_club";
  const parts: string[] = [];

  // The picture, first. Everything below is a qualifier on this.
  if (input.sceneText) {
    parts.push("A photograph of this moment:", input.sceneText);
  } else {
    parts.push("A photograph for a Meta ad.");
  }

  if (input.framingText) {
    parts.push(
      "",
      "HOW THIS SHOT IS FRAMED (the same moment photographed from here, not a wider or safer version of it):",
      input.framingText,
    );
  }

  parts.push("", `This is ${subjectLine(input)}`);
  if (!isBoatClub && input.industry !== "marina" && input.businessTypeDescription) {
    parts.push(`What they do: ${input.businessTypeDescription}`);
  }
  if (isBoatClub && input.boatingStyle) {
    parts.push(`Boating style for this market: ${input.boatingStyle}`);
  }
  if (input.environmentStyle) {
    parts.push(`Environment: ${input.environmentStyle}`);
  }
  if (input.toneKeywords) {
    parts.push(`Mood / tone: ${input.toneKeywords}`);
  }

  parts.push("", cameraBlock(input.camera ?? DEFAULT_CAMERA_REGISTER));
  parts.push(NOT_A_DEMONSTRATION);

  // Hard rules, as a tail.
  parts.push(ANATOMY_CONSTRAINTS);
  if (isBoatClub) parts.push(JUMPING_CONSTRAINTS);
  if (input.reserveOverlaySpace) parts.push(COMPOSITION_CONSTRAINTS);
  parts.push(UNIVERSAL_REALISM);
  // Wakes, gunwales and swim platforms mean nothing in a basement.
  if (isBoatClub || input.industry === "marina") parts.push(MARINE_REALISM);
  parts.push(NO_CHROME);

  if (input.headline) {
    // Passed for context only. The old prompt made this mistake-proof by
    // saying so explicitly, and it is worth keeping.
    parts.push(
      `The headline this image will be paired with is "${input.headline}". It is provided for context ONLY — do NOT render it in the image.`,
    );
  }

  return parts.join("\n");
}
