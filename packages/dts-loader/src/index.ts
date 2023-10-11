import { LoaderContext } from 'webpack'
import fs from 'fs-extra'
import { isEmpty } from 'ramda'
import path from 'path'
import ts from 'typescript'
import crypto from "crypto";

const cache: {
  program?: ts.Program
  languageService?: ts.LanguageService
  fileNameMapping: Record<string, string>
} = { fileNameMapping: {} }

function getTSConfigPath({ cwd, tsConfigFilename }: { cwd: string, tsConfigFilename: string }) {
  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, tsConfigFilename)
  return configPath
}

function getTSConfig({ cwd, tsConfigFilename }: { cwd: string, tsConfigFilename: string }): ts.CompilerOptions {
  const tsconfigPath = getTSConfigPath({ cwd, tsConfigFilename })
  if (!tsconfigPath) {
    throw new Error(`Could not find a valid ${tsconfigPath}: '${tsConfigFilename}'.`)
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

function getFileNames(cwd: string) {
  const tsconfigPath = getTSConfigPath(cwd)
  const tsconfig = getTSConfig(cwd)

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

const files: ts.MapLike<{ version: number, hashedContent: string }> = {}
function getTSService(options: ts.CompilerOptions, cwd: string) {
  if (cache.languageService) {
    return cache.languageService
  }

  const rootFileNames = getFileNames(cwd)

  // initialize the list of files
  rootFileNames.forEach((fileName) => {
    files[fileName] = { version: 0, hashedContent: hash(fs.readFileSync(fileName).toString()) }
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
    getCurrentDirectory: () => cwd,
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

function normalizePath(fileName: string) {
  if (path.sep !== path.posix.sep) {
      return fileName.split(path.sep).join(path.posix.sep)
  }
  return fileName
}

function emitFile(
  context: LoaderContext<Partial<LoaderOptions>>,
  languageService: ts.LanguageService,
  loaderOptions: LoaderOptions,
) {
  const fileName = context.resourcePath
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
                context.resolve(context.rootContext, value, (err, inputFilePath) => {
                  if (err) {
                    console.error(err)
                    return
                  }
                  if (inputFilePath === fileName) {
                    const moduleFilename = `${key}.d.ts`
                    const modulePath = path.resolve(
                      context.rootContext,
                      `${loaderOptions.typesOutputDir}/${loaderOptions.name}`
                    )
                    const dtsEntryPath = path.resolve(modulePath, moduleFilename)
                    const relativePathToOutput = normalizePath(
                      path.relative(
                        path.dirname(dtsEntryPath),
                        o.name.replace('.d.ts', '')
                      )
                    )

                    fs.ensureFileSync(dtsEntryPath)
                    fs.writeFileSync(
                      dtsEntryPath,
                      `export * from './${relativePathToOutput}';\nexport { default } from './${relativePathToOutput}';`
                    )
                  }
                })
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
  tsConfigFilename: string
}

function hash(content: string) {
  const hash = crypto.createHash("md5");
  hash.update(content);
  return hash.digest('hex');
}

function makeLoader(
  context: LoaderContext<Partial<LoaderOptions>>,
  loaderOptions: LoaderOptions,
  content: string
) {
  const fileName = normalizePath(context.resourcePath)
  const hashedContent = hash(content);
  if (files[fileName] && files[fileName].hashedContent !== hashedContent) {
      // Update the content
      files[fileName].hashedContent = hashedContent;
      
      // Update the version to signal a change in the file
      files[fileName].version++;
  }
  
  const tsconfig = getTSConfig({ cwd: context.rootContext, tsConfigFilename: loaderOptions.tsConfigFilename})
  const languageService = getTSService({
    ...tsconfig,
    declaration: true,
    emitDeclarationOnly: true,
    outDir: path.resolve(
      context.rootContext,
      `${loaderOptions.typesOutputDir}/${loaderOptions.name}/dts`
    ),
  }, context.rootContext)

  emitFile(context, languageService, loaderOptions)

  return content
}

export default function loader(content: string) {
  // @ts-ignore
  const context: LoaderContext<Partial<LoaderOptions>> = this
  const loaderOptions = context.getOptions()

  return makeLoader(
    context,
    {
      name: loaderOptions.name,
      exposes: loaderOptions.exposes,
      typesOutputDir: loaderOptions.typesOutputDir || '.wp_federation',
      tsConfigFilename: loaderOptions.tsConfigFilename || 'tsconfig.json',
    },
    content
  )
}
