## dts-loader

Webpack loader to collect `.d.ts` files, the difference between this loader
and `ts-loader` is `dts-loader` only emits `.d.ts` files and it's designed
specifically for the purpose of *sharing webpack module federation exposed types*

Thus, `dts-loader` will not only emits `.d.ts` files, but also will emit the entry
file for the exposed modules based on the configuration of module federation
plugin's `exposes` section.

### Example setup of type sharing for webpack module federation

### 1. dts-loader config

```javascript
{
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'dts-loader',
            options: {
              name: 'app', // The name configured in ModuleFederationPlugin
              exposes: { // The exposes configured in ModuleFederationPlugin
                './Counter': './src/modules/Counter/Counter.component.tsx',
              }
              typesOutputDir: '.wp_federation' // Optional, default is '.wp_federation'
            },
          },
        ],
      },
    ],
  },
}
```

With the above configuration, type definitions are emitted to `.wp_federation/app/dts`

And the entry file for `./Counter` module is emitted to `.wp_federation/app/Counter.d.ts`

### 2. Use the generated types

Then you can copy the entire folder: `.wp_federation/app` and drop it to, for example: `node_modules/@types`

or you can add the custom `typeRoots` to `tsconfig.json` so that TypeScript knows where to resolve types for the module

```javascript
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "*": ["*", "./types/*"] // Wherever you want to put
    },
    "typeRoots": [
      "./types", // Wherever you want to put, just make sure it's the same as the one configured in `paths`
      "./node_modules/@types"
    ]
  },
}
```
Now you can drop `app` folder to `./types`

### 3. Share the generated types

For better development experience, `dts-loader` also generates a tarball for the types where you can find in `.wp_federation`, it's name is `[name]-dts.tgz`.
With the above config, you will find `app-dts.tgz` in `.wp_federation`

you can deploy it along with your application statics, and then the host application can download from remote and unzip it to `typeRoots`. This would make sure the typings are always up-to-date when working across different teams/applications.

### 4. WebpackRemoteTypesPlugin
You can use `WebpackRemoteTypesPlugin` to automate step #3, it will download the tarball from remote and unzip it to the specified folder.

```javascript
new WebpackRemoteTypesPlugin({
  remotes: {
    app: 'app@http://localhost:9000/remoteEntry.js',
  },
  outputDir: 'types',
  remoteFileName: '[name]-dts.tgz' // default filename is [name]-dts.tgz where [name] is the remote name, for example, `app` with the above setup
}),
```

The plugin will download tarball from `http://localhost:9000/app-dts.tgz` and unzip the tarball to `./types` folder

### More advanced setup
Note: the above setup will emit type definitions for the whole application(all ts files that webpack traverse started from the entries).
To avoid emit unnecessary files or missing files(for example, when exposed module is not reachable by the entry). It would be better to
have a separate webpack config for the exposes:

```
{
  entry: {
    './Counter': './src/modules/Counter/Counter.component.tsx',
  }
}
```

