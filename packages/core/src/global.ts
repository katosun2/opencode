import path from "path"
import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"
import os from "os"
import { Context, Effect, Layer } from "effect"
import { Flock } from "./util/flock"
import { Flag } from "./flag/flag"
import { existsSync, readFileSync } from "fs"

const app = "opencode"
const data = path.join(xdgData!, app)
const cache = path.join(xdgCache!, app)
const config = path.join(xdgConfig!, app)
const state = path.join(xdgState!, app)
const tmp = path.join(os.tmpdir(), app)

function readLogDir(): string | undefined {
  // Determine config directory (respect OPENCODE_CONFIG_DIR)
  const configDir = Flag.OPENCODE_CONFIG_DIR || config
  
  // Config file has highest priority
  for (const file of ["config.json", "opencode.json", "opencode.jsonc"]) {
    const filepath = path.join(configDir, file)
    if (!existsSync(filepath)) continue
    try {
      const parsed = JSON.parse(readFileSync(filepath, "utf-8"))
      if (typeof parsed.logDir === "string") return parsed.logDir
    } catch {}
  }
  
  // Fallback to OPENCODE_CONFIG env var
  const envConfig = process.env.OPENCODE_CONFIG
  if (envConfig && existsSync(envConfig)) {
    try {
      const parsed = JSON.parse(readFileSync(envConfig, "utf-8"))
      if (typeof parsed.logDir === "string") return parsed.logDir
    } catch {}
  }
  
  return undefined
}

let customLogDir = readLogDir()

const paths: {
  home: string
  data: string
  bin: string
  log: string
  cache: string
  config: string
  state: string
  tmp: string
  repos: string
} = {
  get home() {
    return process.env.OPENCODE_TEST_HOME ?? os.homedir()
  },
  data,
  bin: path.join(cache, "bin"),
  get log() {
    return customLogDir || path.join(data, "log")
  },
  set log(value: string) {
    customLogDir = value
  },
  cache,
  config,
  state,
  tmp,
  repos: path.join(data, "repos"),
}

export const Path = paths

Flock.setGlobal({ state })

await Promise.all([
  fs.mkdir(Path.data, { recursive: true }),
  fs.mkdir(Path.config, { recursive: true }),
  fs.mkdir(Path.state, { recursive: true }),
  fs.mkdir(Path.tmp, { recursive: true }),
  fs.mkdir(Path.log, { recursive: true }),
  fs.mkdir(Path.bin, { recursive: true }),
  fs.mkdir(Path.repos, { recursive: true }),
])

export class Service extends Context.Service<Service, Interface>()("@opencode/Global") {}

export interface Interface {
  readonly home: string
  readonly data: string
  readonly cache: string
  readonly config: string
  readonly state: string
  readonly tmp: string
  readonly bin: string
  readonly log: string
  readonly repos: string
}

export function make(input: Partial<Interface> = {}): Interface {
  return {
    home: Path.home,
    data: Path.data,
    cache: Path.cache,
    config: Flag.OPENCODE_CONFIG_DIR ?? Path.config,
    state: Path.state,
    tmp: Path.tmp,
    bin: Path.bin,
    log: Path.log,
    repos: Path.repos,
    ...input,
  }
}

export const layer = Layer.effect(
  Service,
  Effect.sync(() => Service.of(make())),
)

export const defaultLayer = layer

export const layerWith = (input: Partial<Interface>) =>
  Layer.effect(
    Service,
    Effect.sync(() => Service.of(make(input))),
  )

export * as Global from "./global"
