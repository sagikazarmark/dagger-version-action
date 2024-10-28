import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'fs'
import * as path from 'path'

export async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github-token', { required: true })

    const workspace = process.env.GITHUB_WORKSPACE || ''
    const daggerJsonPath = path.join(workspace, 'dagger.json')

    let engineVersion: string | undefined

    if (fs.existsSync(daggerJsonPath)) {
      // Read from local file
      core.info('dagger.json found locally. Reading from local file.')

      const content = fs.readFileSync(daggerJsonPath, 'utf8')
      const data = JSON.parse(content)

      engineVersion = data.engineVersion
    } else {
      // Fetch dagger.json via GitHub API
      core.info('dagger.json not found locally. Fetching via GitHub API.')

      const octokit = github.getOctokit(githubToken)

      const { owner, repo } = github.context.repo
      const ref = github.context.ref

      try {
        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: 'dagger.json',
          ref
        })

        // The content is base64 encoded
        if ('content' in response.data && response.data.content) {
          const decodedContent = Buffer.from(
            response.data.content,
            'base64'
          ).toString('utf8')

          const data = JSON.parse(decodedContent)

          engineVersion = data.engineVersion
        } else {
          core.setFailed('dagger.json content is not available.')

          return
        }
      } catch (error: any) {
        if (error.status === 404) {
          core.setFailed('dagger.json not found in the repository.')
        } else {
          core.setFailed(`Error fetching dagger.json: ${error.message}`)
        }

        return
      }
    }

    if (!engineVersion) {
      core.setFailed('engineVersion field is missing in dagger.json.')

      return
    }

    core.setOutput('version', engineVersion)
    core.info(`Dagger version: ${engineVersion}`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}
