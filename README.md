# GitHub Action to get the required [Dagger](https://dagger.io/) version

This action gets the `engineVersion` field from the `dagger.json` file of a repository.

It supports workflows with and without checking out the repository first:

- If the repository is with a `dagger.json` file is present, the action will get the `engineVersion` field from it
- If there is no checked out repository, the action will use the Contents API to get the `dagger.json` file

## Usage


```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  ci:
    name: CI
    runs-on: depot-ubuntu-latest-16

    steps:
      # Optional
      - name: Checkout repository
        uses: actions/checkout

      - name: Get Dagger version
        id: dagger_version
        uses: sagikazarmark/dagger-version-action

      - name: Run pipeline
        uses: dagger/dagger-for-github
        with:
          verb: call
          args: ci
          cloud-token: ${{ secrets.DAGGER_CLOUD_TOKEN }}
          version: ${{ steps.dagger_version.outputs.version }}
```

## License

The project is licensed under the [MIT License](LICENSE).
