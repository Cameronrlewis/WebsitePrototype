/**
 * Converts the monolithic board-model-data.js bundle into one quantized binary
 * payload per board, gzipped.
 *
 * The source bundle stores all three boards as JS object literals in a single
 * 51 MiB file that the viewer loads with a blocking <script>, so opening any
 * board pays for all three plus a full JS parse. Here each board becomes its
 * own file, positions are quantized to Uint16 against a per-mesh/per-axis
 * bounding box, indices take the narrowest type that fits, and normals are
 * dropped (the viewer calls computeVertexNormals() whenever they are absent,
 * which is already what the power and control boards rely on).
 *
 *   node tools/build-board-geometry-bin.mjs
 *
 * Format (all integers little-endian):
 *
 *   0   "PCBG"                    magic
 *   4   uint32  version = 1
 *   8   uint32  headerByteLength
 *   12  header JSON (UTF-8), zero-padded to a 4-byte boundary
 *   …   payload: per mesh, positions then indices, each block 4-byte aligned
 *
 * Positions are stored per axis (all X, then all Y, then all Z) rather than
 * interleaved. Neighbouring values along one axis are similar, which is what
 * makes the payload compress well; interleaving XYZ roughly doubles the
 * gzipped size.
 */
import { gzipSync } from "node:zlib";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const sourcePath = path.join(rootDir, "assets-src/board-geometry/board-model-data.js");
const outputDir = path.join(rootDir, "public/portfolio/assets/viewers/geometry");

const BOARDS = [
  { asset: "power", marker: "const PCB_GEO = " },
  { asset: "control", marker: "const PCB_GEO_CTRL = " },
  { asset: "brick", marker: "const PCB_GEO_BRICK = " },
];

const FORMAT_VERSION = 1;
const QUANT_MAX = 65535;
/** Fail the build rather than ship geometry that drifted during quantization. */
const MAX_ROUND_TRIP_ERROR_MM = 0.005;

function align4(value) {
  return (value + 3) & ~3;
}

/** Splits the bundle on its `const PCB_GEO… = ` markers into raw JSON strings. */
function splitBundle(source) {
  return BOARDS.map((board, index) => {
    const markerIndex = source.indexOf(board.marker);
    if (markerIndex === -1) {
      throw new Error(`Missing marker ${board.marker} in ${sourcePath}`);
    }

    const start = markerIndex + board.marker.length;
    const next = BOARDS[index + 1];
    const end = next ? source.indexOf(next.marker, start) : source.length;
    const raw = source.slice(start, end === -1 ? source.length : end).trim().replace(/;$/, "");

    return { ...board, geometry: JSON.parse(raw), jsonBytes: Buffer.byteLength(raw) };
  });
}

/**
 * Quantizes one mesh and returns its header entry plus the buffers to append.
 * Degenerate axes (every value identical, e.g. a flat board face) get a scale
 * of 0, which decodes back to exactly `min` instead of dividing by zero.
 */
function encodeMesh(mesh, positionOffset) {
  const positions = mesh.v;
  const indices = mesh.i;
  const vertexCount = positions.length / 3;

  if (!Number.isInteger(vertexCount)) {
    throw new Error(`Position array length ${positions.length} is not a multiple of 3`);
  }

  const min = [0, 0, 0];
  const scale = [0, 0, 0];
  const quantized = new Uint16Array(positions.length);

  for (let axis = 0; axis < 3; axis += 1) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let v = 0; v < vertexCount; v += 1) {
      const value = positions[v * 3 + axis];
      if (value < lo) lo = value;
      if (value > hi) hi = value;
    }

    min[axis] = lo;
    scale[axis] = hi - lo;

    const axisBase = axis * vertexCount;
    if (scale[axis] === 0) {
      continue;
    }

    for (let v = 0; v < vertexCount; v += 1) {
      const t = (positions[v * 3 + axis] - lo) / scale[axis];
      quantized[axisBase + v] = Math.round(t * QUANT_MAX);
    }
  }

  // Verify the decode before anything reaches disk.
  let maxError = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const axisBase = axis * vertexCount;
    for (let v = 0; v < vertexCount; v += 1) {
      const decoded = min[axis] + (quantized[axisBase + v] / QUANT_MAX) * scale[axis];
      const error = Math.abs(decoded - positions[v * 3 + axis]);
      if (error > maxError) maxError = error;
    }
  }

  const useUint32 = vertexCount > 65536;
  const indexArray = useUint32 ? new Uint32Array(indices) : new Uint16Array(indices);
  const indexOffset = align4(positionOffset + quantized.byteLength);

  return {
    entry: {
      color: mesh.color,
      vertexCount,
      indexCount: indices.length,
      indexType: useUint32 ? "u32" : "u16",
      min,
      scale,
      positionOffset,
      indexOffset,
    },
    positions: Buffer.from(quantized.buffer, quantized.byteOffset, quantized.byteLength),
    indices: Buffer.from(indexArray.buffer, indexArray.byteOffset, indexArray.byteLength),
    nextOffset: align4(indexOffset + indexArray.byteLength),
    maxError,
  };
}

function encodeBoard(geometry) {
  const entries = [];
  const blocks = [];
  let offset = 0;
  let maxError = 0;
  let droppedNormals = 0;

  for (const mesh of geometry.meshes) {
    if (mesh.n?.length) {
      droppedNormals += mesh.n.length;
    }

    const encoded = encodeMesh(mesh, offset);
    entries.push(encoded.entry);
    blocks.push(encoded);
    offset = encoded.nextOffset;
    maxError = Math.max(maxError, encoded.maxError);
  }

  const payload = Buffer.alloc(offset);
  for (const block of blocks) {
    block.positions.copy(payload, block.entry.positionOffset);
    block.indices.copy(payload, block.entry.indexOffset);
  }

  const headerJson = Buffer.from(JSON.stringify({ meshes: entries }), "utf8");
  const headerLength = align4(headerJson.length);
  const header = Buffer.alloc(12 + headerLength);
  header.write("PCBG", 0, "ascii");
  header.writeUInt32LE(FORMAT_VERSION, 4);
  header.writeUInt32LE(headerLength, 8);
  headerJson.copy(header, 12);

  return { buffer: Buffer.concat([header, payload]), maxError, droppedNormals };
}

const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

async function main() {
  const source = await fs.readFile(sourcePath, "utf8");
  const boards = splitBundle(source);
  await fs.mkdir(outputDir, { recursive: true });

  let totalJson = 0;
  let totalGzip = 0;

  for (const board of boards) {
    const { buffer, maxError, droppedNormals } = encodeBoard(board.geometry);

    if (maxError > MAX_ROUND_TRIP_ERROR_MM) {
      throw new Error(
        `${board.asset}: quantization error ${maxError.toFixed(6)} mm exceeds ` +
          `${MAX_ROUND_TRIP_ERROR_MM} mm — refusing to write`,
      );
    }

    // Deliberately NOT a .gz extension: servers that recognise one set
    // Content-Encoding, the browser pre-inflates, and the viewer's own inflate
    // step then fails. The bytes are gzip either way; the viewer sniffs the
    // magic number rather than trusting the transport.
    const gzipped = gzipSync(buffer, { level: 9 });
    await fs.writeFile(path.join(outputDir, `${board.asset}.pcbgeo`), gzipped);

    totalJson += board.jsonBytes;
    totalGzip += gzipped.length;

    const normals = droppedNormals ? `, dropped ${droppedNormals.toLocaleString()} normals` : "";
    console.log(
      `${board.asset.padEnd(8)} ${board.geometry.meshes.length.toString().padStart(3)} meshes  ` +
        `json ${mib(board.jsonBytes).padStart(9)} -> bin ${mib(buffer.length).padStart(9)} ` +
        `-> gzip ${mib(gzipped.length).padStart(9)}  ` +
        `max error ${(maxError * 1000).toFixed(2)} um${normals}`,
    );
  }

  console.log(
    `\ntotal    json ${mib(totalJson)} -> gzip ${mib(totalGzip)} ` +
      `(was ${mib(totalJson)} downloaded on every board open)`,
  );
}

await main();
