## dts-loader

Webpack loader to collect `.d.ts` files, the difference between this loader
and `ts-loader` is `dts-loader` only emits `.d.ts` files and it's designed
specifically for the purpose of *sharing webpack module federation exposed types*

Thus, `dts-loader` will not only emits `.d.ts` files, but also will emit the entry
file for the exposed modules based on the configuration of module federation
plugin's `exposes` section.

### Example setup of type sharing for webpack module federation

1. dts-loader config

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

With the above configuration, type definitions are emitted to `.wp_federation/exposes/app/dts`

And the entry file for `./Counter` module is emitted to `.wp_federation/exposes/app/Counter.d.ts`

2. Then you can copy the entire folder: `.wp_federation/exposes/app` and drop it to, for example: `node_modules/@types`

or you can add the custom `typeRoots` to `tsconfig.json` so that TypeScript knows where to resolve types for the module

```javascript
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "*": ["*", "./.wp_federation/exposes/*"] // Wherever you want to put
    },
    "typeRoots": [
      "./.wp_federation/remotes", // Wherever you want to put, just make sure it's the same as the one configured in `paths`
      "./node_modules/@types"
    ]
  },
}
```

3. For better development experience, you can zip the folder `.wp_federation/exposes/app` and deploy it along with your application,
and then host application can download from remote and unzip it to `typeRoots`. This would make sure the typings are always up-to-date
when working across different teams.


### TODO
- [] Create a webpack plugin to automate #3
