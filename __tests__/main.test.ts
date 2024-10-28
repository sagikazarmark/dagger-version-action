import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import nock from 'nock'

describe('Get Dagger Version', () => {
  const originalGITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE
  const workspace = path.join(__dirname, 'test-repo')

  beforeAll(() => {
    process.env.GITHUB_WORKSPACE = workspace
    process.env['INPUT_GITHUB-TOKEN'] = 'fake-token'
    fs.mkdirSync(workspace, { recursive: true })
  })

  afterAll(() => {
    process.env.GITHUB_WORKSPACE = originalGITHUB_WORKSPACE
    fs.rmSync(workspace, { recursive: true, force: true })
  })

  afterEach(() => {
    jest.resetModules()
    nock.cleanAll()
  })

  test('reads engineVersion from local dagger.json', () => {
    const daggerJsonContent = { engineVersion: '1.2.3' }
    fs.writeFileSync(
      path.join(workspace, 'dagger.json'),
      JSON.stringify(daggerJsonContent)
    )

    const np = process.execPath
    const ip = path.join(__dirname, '..', 'dist', 'index.js')
    const options: cp.ExecFileSyncOptions = {
      env: process.env
    }
    const output = cp.execFileSync(np, [ip], options)

    expect(output.toString()).toContain('engineVersion: 1.2.3')
  })

  test('fetches engineVersion via GitHub API if dagger.json not local', () => {
    // Remove local dagger.json if exists
    const daggerJsonPath = path.join(workspace, 'dagger.json')
    if (fs.existsSync(daggerJsonPath)) {
      fs.unlinkSync(daggerJsonPath)
    }

    // Mock GitHub API response
    nock('https://api.github.com')
      .get(`/repos/owner/repo/contents/dagger.json`)
      .query(true)
      .reply(200, {
        content: Buffer.from(
          JSON.stringify({ engineVersion: '4.5.6' })
        ).toString('base64')
      })

    process.env['GITHUB_REPOSITORY'] = 'owner/repo'
    process.env['GITHUB_REF'] = 'refs/heads/main'

    const np = process.execPath
    const ip = path.join(__dirname, '..', 'dist', 'index.js')
    const options: cp.ExecFileSyncOptions = {
      env: process.env
    }
    const output = cp.execFileSync(np, [ip], options)

    expect(output.toString()).toContain('engineVersion: 4.5.6')
  })

  test('fails if dagger.json is missing', () => {
    // Remove local dagger.json if exists
    const daggerJsonPath = path.join(workspace, 'dagger.json')
    if (fs.existsSync(daggerJsonPath)) {
      fs.unlinkSync(daggerJsonPath)
    }

    // Mock GitHub API response with 404
    nock('https://api.github.com')
      .get(`/repos/owner/repo/contents/dagger.json`)
      .query(true)
      .reply(404)

    process.env['GITHUB_REPOSITORY'] = 'owner/repo'
    process.env['GITHUB_REF'] = 'refs/heads/main'

    const np = process.execPath
    const ip = path.join(__dirname, '..', 'dist', 'index.js')
    const options: cp.ExecFileSyncOptions = {
      env: process.env
    }

    let errorOccurred = false
    try {
      cp.execFileSync(np, [ip], options)
    } catch (error: any) {
      errorOccurred = true
      expect(error.stdout.toString()).toContain(
        'dagger.json not found in the repository.'
      )
    }
    expect(errorOccurred).toBe(true)
  })
})
