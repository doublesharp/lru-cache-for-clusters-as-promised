# Dependency update, September 11, 2026

Selected compatible stable releases published on or before **September 4, 2026 at 17:02:47 UTC**. Existing major versions and the Node.js 22 minimum are unchanged.

`pnpm-workspace.yaml` now sets `minimumReleaseAge: 10080`, so future pnpm resolution also waits seven days for direct and transitive releases. Frozen lockfile installs retain the reviewed versions.

The npm registry publication timestamps were checked for all 497 package-version entries in the resulting lockfile, including optional platform packages. All meet the cutoff; 202 entries are new relative to the previous lockfile. The eleven direct updates are below.

| Package                             | Previous | Updated | Published, UTC           |
| ----------------------------------- | -------- | ------- | ------------------------ |
| `@types/node`                       | 25.6.0   | 25.9.5  | 2026-07-08T06:47:58.834Z |
| `@typescript-eslint/eslint-plugin`  | 8.59.1   | 8.69.0  | 2026-08-31T17:10:34.452Z |
| `@typescript-eslint/parser`         | 8.59.1   | 8.69.0  | 2026-08-31T17:09:13.713Z |
| `eslint`                            | 10.2.1   | 10.10.0 | 2026-09-04T14:34:21.799Z |
| `eslint-import-resolver-typescript` | 4.4.4    | 4.4.5   | 2026-06-01T04:17:50.360Z |
| `eslint-plugin-import-x`            | 4.16.2   | 4.17.1  | 2026-06-28T07:00:54.891Z |
| `knip`                              | 6.7.0    | 6.34.0  | 2026-08-31T22:54:33.744Z |
| `lru-cache`                         | 11.3.5   | 11.5.2  | 2026-07-07T23:27:14.327Z |
| `prettier`                          | 3.8.3    | 3.9.6   | 2026-07-21T05:51:53.987Z |
| `tsx`                               | 4.21.0   | 4.23.13 | 2026-08-30T00:46:16.265Z |
| `type-coverage`                     | 2.29.7   | 2.30.1  | 2026-07-26T06:46:14.615Z |

Publication dates come from each package's `time` record in the [npm registry](https://registry.npmjs.org/). More recent releases such as TypeScript ESLint 8.70.0 and Knip 6.35.1 were excluded by the cutoff. Major-version migrations for TypeScript, c8, lint-staged, and size-limit are outside this compatible update.

The existing optional `eslint-plugin-import` peer warning remains: its declared ESLint range stops at 9, while this project uses ESLint 10 with `eslint-plugin-import-x`. The resolver already brought in that optional peer before this update; lint verification uses the configured import-x plugin.

Before release, GitHub reported a low-severity Windows development-server advisory in tsup's esbuild dependency. The `tsup>esbuild` override selects 0.28.2, published August 8, 2026. Both tsup and tsx now use that patched version. The final 497 lockfile entries were rechecked against the same cutoff.
