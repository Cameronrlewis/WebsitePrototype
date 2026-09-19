export interface EdgesBbox {
  minx: number;
  miny: number;
  maxx: number;
  maxy: number;
}

export interface Footprint {
  ref: string;
  // Deliberately number[], not [number, number]: do not tighten to a tuple.
  // The test's footprints array is a plain object literal with no contextual
  // type, so TypeScript infers bbox.pos/size as number[]. A tuple type here
  // fails `tsc --noEmit` on that literal even though the values always have
  // exactly two elements at runtime.
  // relpos and angle are optional so a test fixture can give a footprint
  // whose origin is its own centre without spelling both out.
  bbox: { pos: number[]; relpos?: number[]; size: number[]; angle?: number };
}

export declare function toBoardLocal(
  pos: [number, number],
  edgesBbox: EdgesBbox,
  flipY: boolean,
): { x: number; y: number };

export declare function stopCenter(
  refs: string[],
  footprints: Footprint[],
): { pos: [number, number]; span: number };
