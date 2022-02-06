<!-- spell-checker:ignore (names) Deno Gitter (utils) dprint -->

# 🦕 Enhanced Deno commands

## `dxf`, `dxi`, `dxr`, and `dxx`

Fixes...

- ref: [🙏🏻[feat/req] supply $0/%0 to shimmed scripts (cross-platform)](https://github.com/denoland/deno/issues/9874)
- ref: [🙏🏻[feat/req] suppress annoying "Terminate batch job (Y/N)?" for shimmed deno scripts (Windows)](https://github.com/denoland/deno/issues/9873)
- ref: [🐛(or feat request?) CLI apps need original command line (Windows)](https://github.com/denoland/deno/issues/9871)
- ref: [🐛`deno` v1.13 breaks shims using `--allow-plugin`](https://github.com/denoland/deno/issues/11819)

### formatter (`dxf`)

automatically runs `dprint fmt` if `dprint` is available and a config is found in the main repo directory o/w runs `deno fmt`

### installer (`dxi`)

- installs command scripts with an enhanced shim

  - command line expansion enhancement
    - enables automated, bash-like command line expansion (including full brace and advanced glob expansion) for WinOS platforms; pass-through for non-Windows platforms
    - when using the 'xProcess' library, enables scripts to more accurately determine the their invocation text allowing them to show accurate help and examples
  - blocks the annoying "Terminate batch job (Y/N)?" console question when using CTRL-C to interrupt the script
    - the visible "^C^C" can likely be removed as well with raw input and/or signal handling (see feat/req @ <https://github.com/denoland/deno/issues/9995>)

- [WIP] can revise current shims, adding enhanced-shim functionality
  - prototypes for shim revision are contained in the 'tools' directory

### runner (`dxr`)

- runs scripts with the same command line expansion enhancements as `dxi`

- [WIP]
  - automatically run dexter / XTR files
  - automatically set requested permissions
    - warn when setting without a CLI specification
  - can run distant scripts from the command line
    - like `dpx` but also searches within additional directories ('src', ...)
    - can also install the remote script with an '--install' flag

### integrator (`dxx`)

- [WIP]

## dexter / xtr

- [WIP]

## Installation of Tools

```shell
# `dxi`
deno install -A "https://deno.land/x/dxx@v0.0.12/src/dxi.ts"
#
dxi -A "https://deno.land/x/dxx@v0.0.12/src/dxf.ts"
dxi -A "https://deno.land/x/dxx@v0.0.12/src/dxr.ts"
# WIP: dxi .../dxx
#...or (via CDN, with optional version/version-range/latest/commit support)...
# dxi -A "https://cdn.jsdelivr.net/gh/rivy/deno.dxx@v0.0.12/src/dxf.ts" // v0.0.12
# dxi -A "https://cdn.jsdelivr.net/gh/rivy/deno.dxx@COMMIT/src/dxf.ts"  // commit
```

## Using the 'xProcess' library

Solely using `dxr` (after installation with `dxi`) as a script runner will perform _bash-like argument expansion_ for the target script while _preserving correct quote semantics_ for both double and single quoted arguments. Additional functionality requires use of the 'xProcess' library in coordination with either an enhanced runner, such as `dxr`, an enhanced shim (provided by installation with `dxi`), or using FFI (currently [as of 2022-01-01] requiring the use of `--unstable`).

Comparisons of `eg\args.ts` (using 'xProcess') vs `args-naive.ts` (without 'xProcess', using only `deno` built-ins) in various scenarios...

```shell
C:> ::# `deno`-only support => no expansion and uneven quote support with loss of quote context
C:> deno run -A eg/args-naive.ts '*' * "*"
'*' * *

C:> ::# `deno` for scripts using 'xProcess' => bash-like expansion, but broken preservation of quoted arguments
C:> deno run -A eg/args.ts '*' * "*"
* bench CHANGELOG.mkd eg LICENSE README.md src tests tools tsconfig.json VERSION bench CHANGELOG.mkd eg LICENSE README.md src tests tools tsconfig.json VERSION

C:> ::# `dxr` => bash-like expansion with preservation of quoted arguments
C:> dxr eg/args-naive.ts '*' * "*"
* bench CHANGELOG.mkd eg LICENSE README.md src tests tools tsconfig.json VERSION *

C:> ::# `dxr` => bash-like expansion with preservation of quoted arguments; better `$0` functionality available
C:> dxr eg/args.ts '*' * "*"
* bench CHANGELOG.mkd eg LICENSE README.md src tests tools tsconfig.json VERSION *
```

Fully capable, completely self-contained, executable binaries can be built from scripts which use the 'xProcess' library by compiling them with the `--allow-all` and `--unstable` flags. For example, using `deno compile -A --unstable eg/args.ts` (from the main project directory, on the WinOS platform) will produce a binary `args.exe` which contains all the enhanced argument functionality and requires no extra support. The resultant `args.exe` binary may be moved to any other WinOS platform and executed with full fidelity.

## Development

### Tools

- [`bmp`](https://github.com/rivy-go/git-changelog) (v1.1+) ... synchronizes version strings within the project
  - install using `dxi --allow-read=. --allow-write=. --allow-run=git -qf https://deno.land/x/bmp@v0.0.6/cli.ts`
- [`git-changelog`](https://github.com/rivy-go/git-changelog) (v1.1+) ... enables changelog automation
  - install using `go get -u github.com/rivy-go/git-changelog/cmd/git-changelog`

### Maintenance

#### CHANGELOG

`git changelog > CHANGELOG.mkd`

#### Version

- `bmp` ~ check project for synchronized version strings
- `bmp --commit --[major|minor|patch]` ~ update project version strings

### Version update process

```shell
bmp --[major|minor|patch]
git changelog --next-tag v$(cat VERSION) > CHANGELOG.mkd
bmp --commit
```

## Testing

`deno test`

## Benchmarking

`dxr bench/bench-parser.ts`
