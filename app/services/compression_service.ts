import { RiotAPITypes } from '@fightmegg/riot-api'
import {
    compress as compressJson,
    Compressed,
    decompress as decompressJson,
} from 'compress-json'
import { brotliCompress, brotliDecompress } from 'node:zlib'
import { promisify } from 'node:util'
import { MAP, CH_MAP } from '#constants/compression.constants'
import { CompressedMatch } from '#types/compression.types'

const brotliCompressAsync = promisify(brotliCompress)
const brotliDecompressAsync = promisify(brotliDecompress)

for (const [k, v] of Object.entries(CH_MAP)) {
    if (!(k in MAP)) MAP[k] = v
}

const REV: Record<string, string> = {}
for (const [longK, shortK] of Object.entries(MAP)) {
    if (REV[shortK as string] && REV[shortK as string] !== longK) {
        throw new Error(
            `Short key collision on "${shortK}" between "${REV[shortK as string]}" and "${longK}"`
        )
    }
    REV[shortK as string] = longK
}

class CompressionService {
    /**
     *
     * Compresses a Riot MatchDTO object into a compact string.
     * Steps:
     *  - Convert long keys to short keys using MAP
     *  - Compress the resulting object using compress-json
     *  - Brotli compress the JSON string
     *  - Encode the compressed data to base64
     *
     * @param match
     * @returns compressed match string
     */
    async compress(
        match: RiotAPITypes.MatchV5.MatchDTO
    ): Promise<CompressedMatch> {
        if (!match || typeof match !== 'object')
            throw new TypeError('compress() needs an object')

        const compact = compressJson(
            this.toShort(match) as RiotAPITypes.MatchV5.MatchDTO
        )
        const json = JSON.stringify(compact)
        const brotli = await brotliCompressAsync(Buffer.from(json, 'utf8'))

        return brotli.toString('base64')
    }

    async decompress(
        input: CompressedMatch
    ): Promise<RiotAPITypes.MatchV5.MatchDTO> {
        if (!input) throw new TypeError('decompress() needs data')

        const buffer = Buffer.from(input, 'base64')
        const decompressedBuffer = await brotliDecompressAsync(buffer)
        const json = decompressedBuffer.toString('utf8')
        const compact = JSON.parse(json) as Compressed
        const decompressed = decompressJson<RiotAPITypes.MatchV5.MatchDTO>(compact)

        return this.toLong(decompressed) as RiotAPITypes.MatchV5.MatchDTO
    }

    private toShort = (v: any): any =>
        Array.isArray(v)
            ? v.map(this.toShort)
            : v && typeof v === 'object'
                ? Object.fromEntries(
                    Object.entries(v).map(([k, val]) => [
                        MAP[k] ?? k,
                        this.toShort(val),
                    ])
                )
                : v

    private toLong = (v: any): any =>
        Array.isArray(v)
            ? v.map(this.toLong)
            : v && typeof v === 'object'
                ? Object.fromEntries(
                    Object.entries(v).map(([k, val]) => [
                        REV[k] ?? k,
                        this.toLong(val),
                    ])
                )
                : v
}

export default new CompressionService()
