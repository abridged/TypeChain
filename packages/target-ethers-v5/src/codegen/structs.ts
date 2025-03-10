import { StructName, StructType } from '@collabland/typechain'
import { groupBy } from 'lodash'

import { STRUCT_INPUT_POSTFIX, STRUCT_OUTPUT_POSTFIX } from '../common'
import { generateInputType, generateOutputType } from './types'

export function generateStructTypes(structs: StructType[]) {
  const namedStructs = structs.filter((s): s is StructWithName => !!s.structName)
  const namespaces = groupBy(namedStructs, (s) => s.structName.namespace)

  const exports: string[] = []

  if ('undefined' in namespaces) {
    exports.push(namespaces['undefined'].map((s) => generateExports(s)).join('\n'))
    delete namespaces['undefined']
  }

  for (const namespace of Object.keys(namespaces)) {
    exports.push(`\nexport declare namespace ${namespace} {
      ${namespaces[namespace].map((s) => generateExports(s)).join('\n')}
    }`)
  }

  return exports.join('\n')
}

function generateExports(struct: StructWithName): string {
  const { identifier } = struct.structName

  const inputName = `${identifier}${STRUCT_INPUT_POSTFIX}`
  const outputName = `${identifier}${STRUCT_OUTPUT_POSTFIX}`
  const inputType = generateInputType({ useStructs: false }, struct)
  const outputType = generateOutputType({ useStructs: false }, struct)

  return `
    export type ${inputName} = ${inputType}

    export type ${outputName} = ${outputType}
  `
}

type StructWithName = StructType & { structName: StructName }
