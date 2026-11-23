/**
 * Lightweight, zero-dependency QR Code Version 1..10 (Byte mode, ECC Level L)
 * generator that returns an SVG data string or path data.
 */

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i += 1) {
    EXP[i] = EXP[i - 255]
  }
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1)
    const root = EXP[i]
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], root)
    }
    poly = next
  }
  return poly
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen)
  const rem = new Uint8Array(ecLen)
  for (let i = 0; i < data.length; i += 1) {
    const factor = data[i] ^ rem[0]
    rem.copyWithin(0, 1)
    rem[ecLen - 1] = 0
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j += 1) {
        rem[j] ^= gfMul(gen[j + 1], factor)
      }
    }
  }
  return rem
}

interface VersionSpec {
  version: number
  totalDataBytes: number
  ecBytesPerBlock: number
  blocks: number
  alignment: number[]
}

// Versions 1 to 10 at ECC Level L
const VERSIONS: VersionSpec[] = [
  { version: 1, totalDataBytes: 19, ecBytesPerBlock: 7, blocks: 1, alignment: [] },
  { version: 2, totalDataBytes: 34, ecBytesPerBlock: 10, blocks: 1, alignment: [6, 18] },
  { version: 3, totalDataBytes: 55, ecBytesPerBlock: 15, blocks: 1, alignment: [6, 22] },
  { version: 4, totalDataBytes: 80, ecBytesPerBlock: 20, blocks: 1, alignment: [6, 26] },
  { version: 5, totalDataBytes: 108, ecBytesPerBlock: 26, blocks: 1, alignment: [6, 30] },
  { version: 6, totalDataBytes: 136, ecBytesPerBlock: 18, blocks: 2, alignment: [6, 34] },
  { version: 7, totalDataBytes: 156, ecBytesPerBlock: 20, blocks: 2, alignment: [6, 22, 38] },
  { version: 8, totalDataBytes: 194, ecBytesPerBlock: 24, blocks: 2, alignment: [6, 24, 42] },
  { version: 9, totalDataBytes: 232, ecBytesPerBlock: 30, blocks: 2, alignment: [6, 26, 46] },
  { version: 10, totalDataBytes: 274, ecBytesPerBlock: 18, blocks: 4, alignment: [6, 28, 50] }
]

function pickVersion(byteLength: number): VersionSpec {
  for (const spec of VERSIONS) {
    const headerBytes = spec.version >= 10 ? 3 : 2
    if (byteLength + headerBytes <= spec.totalDataBytes) return spec
  }
  return VERSIONS[VERSIONS.length - 1]
}

function encodeDataCodewords(bytes: Uint8Array, spec: VersionSpec): Uint8Array {
  const bits: number[] = []
  const pushBits = (val: number, len: number): void => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((val >> i) & 1)
    }
  }
  // Byte mode indicator (0100)
  pushBits(0b0100, 4)
  pushBits(bytes.length, spec.version >= 10 ? 16 : 8)
  for (const b of bytes) pushBits(b, 8)

  const maxBits = spec.totalDataBytes * 8
  const terminator = Math.min(4, Math.max(0, maxBits - bits.length))
  pushBits(0, terminator)
  while (bits.length % 8 !== 0) bits.push(0)

  const codewords = new Uint8Array(spec.totalDataBytes)
  const byteLen = Math.min(codewords.length, bits.length / 8)
  for (let i = 0; i < byteLen; i += 1) {
    let val = 0
    for (let b = 0; b < 8; b += 1) {
      val = (val << 1) | bits[i * 8 + b]
    }
    codewords[i] = val
  }
  const pads = [0xec, 0x11]
  for (let i = byteLen; i < codewords.length; i += 1) {
    codewords[i] = pads[(i - byteLen) % 2]
  }
  return codewords
}

function interleaveBlocks(data: Uint8Array, spec: VersionSpec): Uint8Array {
  const blocks: Uint8Array[] = []
  const ecs: Uint8Array[] = []
  const baseBlockSize = Math.floor(spec.totalDataBytes / spec.blocks)
  const extraBlocks = spec.totalDataBytes % spec.blocks
  let offset = 0
  for (let i = 0; i < spec.blocks; i += 1) {
    const len = baseBlockSize + (i >= spec.blocks - extraBlocks ? 1 : 0)
    const block = data.subarray(offset, offset + len)
    offset += len
    blocks.push(block)
    ecs.push(rsEncode(block, spec.ecBytesPerBlock))
  }

  const out: number[] = []
  const maxDataLen = baseBlockSize + (extraBlocks > 0 ? 1 : 0)
  for (let col = 0; col < maxDataLen; col += 1) {
    for (let b = 0; b < spec.blocks; b += 1) {
      if (col < blocks[b].length) out.push(blocks[b][col])
    }
  }
  for (let col = 0; col < spec.ecBytesPerBlock; col += 1) {
    for (let b = 0; b < spec.blocks; b += 1) {
      out.push(ecs[b][col])
    }
  }
  return new Uint8Array(out)
}

function bchFormatInfo(mask: number): number {
  // ECC Level L = 01
  const data = (0b01 << 3) | mask
  let d = data << 10
  for (let i = 4; i >= 0; i -= 1) {
    if (d & (1 << (i + 10))) {
      d ^= 0b10100110111 << i
    }
  }
  return ((data << 10) | d) ^ 0b101010000010010
}

function bchVersionInfo(version: number): number {
  let d = version << 12
  for (let i = 5; i >= 0; i -= 1) {
    if (d & (1 << (i + 12))) {
      d ^= 0b1111100100101 << i
    }
  }
  return (version << 12) | d
}

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text)
  const spec = pickVersion(bytes.length)
  const size = spec.version * 4 + 17
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  const setFunction = (r: number, c: number, dark: boolean): void => {
    if (r < 0 || r >= size || c < 0 || c >= size) return
    modules[r][c] = dark
    isFunc[r][c] = true
  }

  const drawFinder = (r0: number, c0: number): void => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
        setFunction(r0 + dr, c0 + dc, inOuter && (onBorder || inInner))
      }
    }
  }

  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    setFunction(6, i, i % 2 === 0)
    setFunction(i, 6, i % 2 === 0)
  }

  // Alignment patterns
  const align = spec.alignment
  for (let i = 0; i < align.length; i += 1) {
    for (let j = 0; j < align.length; j += 1) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === align.length - 1) ||
        (i === align.length - 1 && j === 0)
      ) {
        continue
      }
      const r0 = align[i]
      const c0 = align[j]
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1
          setFunction(r0 + dr, c0 + dc, dark)
        }
      }
    }
  }

  // Reserve format information areas
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      setFunction(8, i, false)
      setFunction(i, 8, false)
    }
  }
  for (let i = 0; i < 8; i += 1) {
    setFunction(8, size - 1 - i, false)
    setFunction(size - 1 - i, 8, false)
  }
  // Dark module
  setFunction(size - 8, 8, true)

  // Version info if version >= 7
  if (spec.version >= 7) {
    const vInfo = bchVersionInfo(spec.version)
    for (let i = 0; i < 18; i += 1) {
      const bit = ((vInfo >> i) & 1) === 1
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      setFunction(b, a, bit)
      setFunction(a, b, bit)
    }
  }

  const dataWords = encodeDataCodewords(bytes, spec)
  const allWords = interleaveBlocks(dataWords, spec)

  // Place data bits in zigzag
  let bitIdx = 0
  const totalBits = allWords.length * 8
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert += 1) {
      const r = upward ? size - 1 - vert : vert
      for (let j = 0; j < 2; j += 1) {
        const c = right - j
        if (!isFunc[r][c]) {
          let dark = false
          if (bitIdx < totalBits) {
            dark = ((allWords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1
            bitIdx += 1
          }
          // Apply mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) dark = !dark
          modules[r][c] = dark
        }
      }
    }
    upward = !upward
  }

  // Write format info for mask 0
  const formatBits = bchFormatInfo(0)
  for (let i = 0; i <= 5; i += 1) setFunction(8, i, ((formatBits >> i) & 1) === 1)
  setFunction(8, 7, ((formatBits >> 6) & 1) === 1)
  setFunction(8, 8, ((formatBits >> 7) & 1) === 1)
  setFunction(7, 8, ((formatBits >> 8) & 1) === 1)
  for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, ((formatBits >> i) & 1) === 1)

  for (let i = 0; i < 8; i += 1) setFunction(8, size - 1 - i, ((formatBits >> i) & 1) === 1)
  for (let i = 8; i < 15; i += 1) setFunction(size - 15 + i, 8, ((formatBits >> i) & 1) === 1)

  return modules
}

export function qrSvgPath(text: string): { size: number; path: string } {
  const matrix = generateQrMatrix(text)
  const size = matrix.length
  const parts: string[] = []
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (matrix[r][c]) {
        parts.push(`M${c},${r}h1v1h-1z`)
      }
    }
  }
  return { size, path: parts.join('') }
}
