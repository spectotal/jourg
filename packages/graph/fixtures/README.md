# Graph Fixtures

These fixtures are meant for stepping through the compiler in a debugger, not for production packaging.

## Fixtures

- `imports/entry.jsonld`
  Main happy-path fixture. It imports `checkout.jsonld`, so you can watch file loading and import normalization in `resolveSources()`.
- `imports/checkout.jsonld`
  Secondary document used by the imported fixture.
- `invalid/entry.jsonld`
  Minimal invalid graph that reaches `validateGraph()` and produces reference diagnostics.
- `cycle/a.jsonld`
  Entry fixture for import-cycle debugging.
- `cycle/b.jsonld`
  Second cycle fixture imported by `a.jsonld`.

## Suggested Order

1. Start with `imports/entry.jsonld`.
2. Move to `invalid/entry.jsonld` once you want to inspect diagnostics.
3. Use `cycle/a.jsonld` when you want to debug the resolver before graph extraction runs.
