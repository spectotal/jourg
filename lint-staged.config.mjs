export default {
  "**/*.{js,mjs,cjs,ts,tsx}": ["eslint --no-warn-ignored --fix", "prettier --write"],
  "**/*.{json,jsonld,md,css,html,yaml,yml}": "prettier --ignore-unknown --write"
}
