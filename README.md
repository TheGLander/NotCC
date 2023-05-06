# NotCC

NotCC, standing for Nice Optimal Terrific Cool Challenge, is a tile based which is trying to reimplement Chip's Challenge 2®.

## Building

To build this project, you first must install [Node.js](https://nodejs.org/en/download) and [PNPM](https://pnpm.io/installation#using-corepack).

### Web player

The web player can built by running `pnpm build-web`.

The built web player files will be located in the `gamePlayer/dist` disrectory.
Serve them with your favorite HTTP server (if you have Python install, try
`python -m http.server`).

### CLI

The CLI can be built by running `pnpm build-cli`.

After a successful build, the CLI can be invoked by running `pnpm notcc <your
command>`.
To run built-in solutions for all C2M files in a directory, you should run `pnpm
notcc verify <dir> --hide success`.
The CLI has documentation build in, invoked by not giving a command or by
passing `--help`.

### Development

If you wish to modify NotCC, you can run `pnpm dev` in all packages you wish to
modify. (`@notcc/logic` contains the actual game logic, `@notcc/player` is the
web player, `@notcc/cli` is the CLI).

Note: There is currently a bug in Vite, the
web player's build utility, where `r` must be pressed each time the logic
package is rebuilt.
