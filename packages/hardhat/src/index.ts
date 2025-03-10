import './type-extensions'

import type { PublicConfig as RunTypeChainConfig } from '@collabland/typechain'
import { TASK_CLEAN, TASK_COMPILE, TASK_COMPILE_SOLIDITY_COMPILE_JOBS } from 'hardhat/builtin-tasks/task-names'
import { extendConfig, subtask, task, types } from 'hardhat/config'
import { getFullyQualifiedName } from 'hardhat/utils/contract-names'

import { getDefaultTypechainConfig } from './config'
import { TASK_TYPECHAIN, TASK_TYPECHAIN_GENERATE_TYPES } from './constants'

const taskArgsStore: { noTypechain: boolean; fullRebuild: boolean } = { noTypechain: false, fullRebuild: false }

extendConfig((config) => {
  config.typechain = getDefaultTypechainConfig(config)
})

task(TASK_COMPILE)
  .addFlag('noTypechain', 'Skip Typechain compilation')
  .setAction(async ({ noTypechain }: { noTypechain: boolean }, { config }, runSuper) => {
    // just save task arguments for later b/c there is no easier way to access them in subtask
    taskArgsStore.noTypechain = noTypechain!! || config.typechain.dontOverrideCompile

    await runSuper()
  })

subtask(TASK_COMPILE_SOLIDITY_COMPILE_JOBS, 'Compiles the entire project, building all artifacts').setAction(
  async (taskArgs, { run }, runSuper) => {
    const compileSolOutput = await runSuper(taskArgs)
    await run(TASK_TYPECHAIN_GENERATE_TYPES, { compileSolOutput, quiet: taskArgs.quiet })
    return compileSolOutput
  },
)

subtask(TASK_TYPECHAIN_GENERATE_TYPES)
  .addParam('compileSolOutput', 'Solidity compilation output', {}, types.any)
  .addFlag('quiet', 'Makes the process less verbose')
  .setAction(async ({ compileSolOutput, quiet }, { config, artifacts }) => {
    const artifactFQNs: string[] = getFQNamesFromCompilationOutput(compileSolOutput)
    const artifactPaths = Array.from(
      new Set(artifactFQNs.map((fqn) => artifacts.formArtifactPathFromFullyQualifiedName(fqn))),
    )

    if (taskArgsStore.noTypechain) {
      return compileSolOutput
    }

    // RUN TYPECHAIN TASK
    const typechainCfg = config.typechain
    if (artifactPaths.length === 0 && !taskArgsStore.fullRebuild && !typechainCfg.externalArtifacts) {
      if (!quiet) {
        // eslint-disable-next-line no-console
        console.log('No need to generate any newer typings.')
      }

      return compileSolOutput
    }

    // incremental generation is only supported in 'ethers-v5' and 'ethers-v6'
    // @todo: probably targets should specify somehow if then support incremental generation this won't work with custom targets
    const needsFullRebuild =
      taskArgsStore.fullRebuild || (typechainCfg.target !== 'ethers-v5' && typechainCfg.target !== 'ethers-v6')
    if (!quiet) {
      // eslint-disable-next-line no-console
      console.log(
        `Generating typings for: ${artifactPaths.length} artifacts in dir: ${typechainCfg.outDir} for target: ${typechainCfg.target}`,
      )
    }
    const cwd = config.paths.root

    const { glob } = await import('@collabland/typechain')
    const allFiles = glob(cwd, [`${config.paths.artifacts}/!(build-info)/**/+([a-zA-Z0-9_]).json`])
    if (typechainCfg.externalArtifacts) {
      allFiles.push(...glob(cwd, typechainCfg.externalArtifacts, false))
    }

    const typechainOptions: Omit<RunTypeChainConfig, 'filesToProcess'> = {
      cwd,
      allFiles,
      outDir: typechainCfg.outDir,
      target: typechainCfg.target,
      flags: {
        alwaysGenerateOverloads: typechainCfg.alwaysGenerateOverloads,
        discriminateTypes: typechainCfg.discriminateTypes,
        tsNocheck: typechainCfg.tsNocheck,
        environment: 'hardhat',
        node16Modules: typechainCfg.node16Modules,
      },
    }

    const { runTypeChain } = await import('@collabland/typechain')
    const result = await runTypeChain({
      ...typechainOptions,
      filesToProcess: needsFullRebuild ? allFiles : glob(cwd, artifactPaths), // only process changed files if not doing full rebuild
    })

    if (!quiet) {
      // eslint-disable-next-line no-console
      console.log(`Successfully generated ${result.filesGenerated} typings!`)
    }

    // if this is not full rebuilding, always re-generate types for external artifacts
    if (!needsFullRebuild && typechainCfg.externalArtifacts) {
      const result = await runTypeChain({
        ...typechainOptions,
        filesToProcess: glob(cwd, typechainCfg.externalArtifacts!, false), // only process files with external artifacts
      })

      if (!quiet) {
        // eslint-disable-next-line no-console
        console.log(`Successfully generated ${result.filesGenerated} typings for external artifacts!`)
      }
    }
  })

task(TASK_TYPECHAIN, 'Generate Typechain typings for compiled contracts').setAction(async (_, { run }) => {
  taskArgsStore.fullRebuild = true
  await run(TASK_COMPILE, { quiet: true })
})

task(
  TASK_CLEAN,
  'Clears the cache and deletes all artifacts',
  async ({ global }: { global: boolean }, { config }, runSuper) => {
    if (global) {
      return runSuper()
    }

    const fsExtra = await import('fs-extra')
    if (await fsExtra.pathExists(config.typechain.outDir)) {
      await fsExtra.remove(config.typechain.outDir)
    }

    await runSuper()
  },
)

function getFQNamesFromCompilationOutput(compileSolOutput: any): string[] {
  const allFQNNamesNested = compileSolOutput.artifactsEmittedPerJob.map((a: any) => {
    return a.artifactsEmittedPerFile.map((artifactPerFile: any) => {
      return artifactPerFile.artifactsEmitted.map((artifactName: any) => {
        return getFullyQualifiedName(artifactPerFile.file.sourceName, artifactName)
      })
    })
  })

  return allFQNNamesNested.flat(2)
}
