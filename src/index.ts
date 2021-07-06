import { LoaderContext } from 'webpack'
import fs from 'fs-extra'
import { isEmpty } from 'ramda'
import loaderUtils from 'loader-utils'
import path from 'path'
import ts from 'typescript'

const cwd = process.cwd()

const cache: {
  program?: ts.Program
  languageService?: ts.LanguageService
  fileNameMapping: Record<string, string>
} = { fileNameMapping: {} }

function getTSConfigPath() {
  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, 'tsconfig.json')
  return configPath
}

function getTSConfig(): ts.CompilerOptions {
  const tsconfigPath = getTSConfigPath()
  if (!tsconfigPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.")
  }

  const tsconfig = require(tsconfigPath)
  return tsconfig
}

const parseConfigHost = {
  fileExists: fs.existsSync,
  readDirectory: ts.sys.readDirectory,
  readFile: function (file: string) {
    return fs.readFileSync(file, 'utf8')
  },
  useCaseSensitiveFileNames: true,
}

function getFileNames() {
  const tsconfigPath = getTSConfigPath()
  const tsconfig = getTSConfig()

  if (tsconfigPath) {
    const parsed = ts.parseJsonConfigFileContent(
      tsconfig,
      parseConfigHost,
      path.dirname(tsconfigPath)
    )
    return parsed.fileNames
  }
  return []
}

function getTSService(options: ts.CompilerOptions) {
  if (cache.languageService) {
    return cache.languageService
  }

  const rootFileNames = getFileNames()

  const files: ts.MapLike<{ version: number }> = {}

  // initialize the list of files
  rootFileNames.forEach((fileName) => {
    files[fileName] = { version: 0 }
  })

  const servicesHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => rootFileNames,
    getScriptVersion: (fileName) =>
      files[fileName] && files[fileName].version.toString(),
    getScriptSnapshot: (fileName) => {
      if (!fs.existsSync(fileName)) {
        return undefined
      }

      return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString())
    },
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  }

  const languageService = ts.createLanguageService(
    servicesHost,
    ts.createDocumentRegistry()
  )
  cache.languageService = languageService

  return languageService
}

function emitFile(
  fileName: string,
  languageService: ts.LanguageService,
  loaderOptions: LoaderOptions
) {
  try {
    const output = languageService.getEmitOutput(fileName)
    if (!output.emitSkipped) {
      output.outputFiles.forEach((o) => {
        if (o.name.endsWith('.d.ts')) {
          fs.ensureDirSync(path.dirname(o.name))
          fs.writeFileSync(o.name, o.text)

          if (
            loaderOptions.exposes &&
            !isEmpty(loaderOptions.exposes) &&
            !isEmpty(loaderOptions.name)
          ) {
            for (const [key, value] of Object.entries(loaderOptions.exposes)) {
              if (key && value) {
                const entryPath = path.resolve(cwd, value)
                if (entryPath === fileName) {
                  const moduleFilename = `${key}.d.ts`
                  const modulePath = path.resolve(
                    cwd,
                    `${loaderOptions.typesOutputDir}/${loaderOptions.name}`
                  )
                  fs.writeFileSync(
                    path.resolve(modulePath, moduleFilename),
                    `export * from './${path.relative(
                      path.relative(cwd, modulePath),
                      o.name.replace('.d.ts', '')
                    )}';\nexport { default } from './${path.relative(
                      path.relative(cwd, modulePath),
                      o.name.replace('.d.ts', '')
                    )}';`
                  )
                }
              }
            }
          }
        }
      })
    }
  } catch (e) {
    console.log(`Skip ${fileName}`)
  }
}

interface LoaderOptions {
  name?: string
  exposes?: Record<string, string>
  typesOutputDir: string
}

function makeLoader(
  context: LoaderContext<any>,
  loaderOptions: LoaderOptions,
  content: string
) {
  const tsconfig = getTSConfig()
  const languageService = getTSService({
    ...tsconfig,
    declaration: true,
    emitDeclarationOnly: true,
    outDir: path.resolve(
      cwd,
      `${loaderOptions.typesOutputDir}/${loaderOptions.name}/dts`
    ),
  })

  emitFile(context.resourcePath, languageService, loaderOptions)

  return content
}

export default function loader(content: string) {
  // @ts-ignore
  const context = this
  const loaderOptions: Partial<LoaderOptions> = loaderUtils.getOptions(context)

  return makeLoader(
    context,
    {
      name: loaderOptions.name,
      exposes: loaderOptions.exposes,
      typesOutputDir: loaderOptions.typesOutputDir || '.wp_federation',
    },
    content
  )
}
