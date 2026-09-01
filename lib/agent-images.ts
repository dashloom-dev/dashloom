export const AGENT_IMAGE_MAX_COUNT = 4;
export const AGENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AGENT_IMAGE_MAX_TOTAL_BYTES = 12 * 1024 * 1024;
export const AGENT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

export type AgentImageInput = {
  label: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  byteSize: number;
  sha256: string;
  dataUrl: string;
};

export type AgentImageEvidence = Omit<AgentImageInput, 'dataUrl'> & { evidenceId: string };

export class AgentImageValidationError extends Error {
  readonly code = 'IMAGE_INPUT_INVALID';
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'AgentImageValidationError';
  }
}

export class AgentVisionUnsupportedError extends Error {
  readonly code = 'PROVIDER_VISION_UNSUPPORTED';
  readonly statusCode: number;

  constructor(statusCode = 400) {
    super('The connected AI model rejected image input. Choose a vision-capable model or remove the images and try again.');
    this.name = 'AgentVisionUnsupportedError';
    this.statusCode = statusCode;
  }
}

function detectedMimeType(bytes: Uint8Array): AgentImageInput['mimeType'] | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

function base64(bytes: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function hex(bytes: Uint8Array) {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function validateAgentImageFiles(entries: FormDataEntryValue[]): Promise<AgentImageInput[]> {
  const files = entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > AGENT_IMAGE_MAX_COUNT) throw new AgentImageValidationError(`Attach up to ${AGENT_IMAGE_MAX_COUNT} images per message.`);
  if (files.reduce((total, file) => total + file.size, 0) > AGENT_IMAGE_MAX_TOTAL_BYTES) throw new AgentImageValidationError('The attached images exceed the 12 MB total limit.');

  const validated = await Promise.all(files.map(async (file, index) => {
    if (file.size > AGENT_IMAGE_MAX_BYTES) throw new AgentImageValidationError(`Image ${index + 1} exceeds the 5 MB limit.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = detectedMimeType(bytes);
    if (!mimeType) throw new AgentImageValidationError(`Image ${index + 1} is not a valid PNG, JPEG, or WebP file.`);
    if (file.type && file.type !== mimeType) throw new AgentImageValidationError(`Image ${index + 1} content does not match its declared file type.`);
    const sha256 = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
    return { label: `Image ${index + 1}`, mimeType, byteSize: bytes.byteLength, sha256, dataUrl: `data:${mimeType};base64,${base64(bytes)}` };
  }));
  if (new Set(validated.map((image) => image.sha256)).size !== validated.length) throw new AgentImageValidationError('Remove duplicate image attachments and try again.');
  return validated;
}

export function agentImageEvidence(images: AgentImageInput[]): AgentImageEvidence[] {
  return images.map((image) => ({ evidenceId: `image:${image.sha256}`, label: image.label, mimeType: image.mimeType, byteSize: image.byteSize, sha256: image.sha256 }));
}
