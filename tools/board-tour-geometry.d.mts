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
  bbox: { pos: number[]; size: number[] };
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
