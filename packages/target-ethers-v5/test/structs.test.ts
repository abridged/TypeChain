import { StructName } from '@collabland/typechain'
import { expect } from 'earljs'
import { format } from 'prettier'

import { generateStructTypes } from '../src/codegen/structs'

const prettier = (s: string) => format(s, { parser: 'typescript' })

describe(generateStructTypes.name, () => {
  it('generates export declarations for top level and namespaced structs', () => {
    const actual = generateStructTypes([
      {
        type: 'tuple',
        components: [
          { name: 'target', type: { type: 'address', originalType: 'address' } },
          { name: 'callData', type: { type: 'dynamic-bytes', originalType: 'bytes' } },
        ],
        originalType: 'tuple',
        structName: new StructName('Call', 'Multicall'),
      },
      {
        structName: new StructName('Vector2'),
        type: 'tuple',
        originalType: 'tuple',
        components: [
          { name: 'x', type: { originalType: 'uint256', type: 'uinteger', bits: 256 } },
          { name: 'y', type: { originalType: 'uint256', type: 'uinteger', bits: 256 } },
        ],
      },
    ])

    expect(prettier(actual)).toEqual(
      prettier(
        `
        export type Vector2Struct = { x: BigNumberish, y: BigNumberish }

        export type Vector2StructOutput = [BigNumber, BigNumber] & { x: BigNumber, y: BigNumber }

        export declare namespace Multicall {
          export type CallStruct = { target: string, callData: BytesLike }

          export type CallStructOutput = [string, string] & { target: string, callData: string }
        }`,
      ),
    )
  })
})
