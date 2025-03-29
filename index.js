const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    // Get the path parameter (defaults to empty string which means root)
    const dirPath = core.getInput('path');

    // Build the file path, joining the directory path if provided
    const jsonFileName = 'dagger.json';
    const filePath = dirPath ?
      path.join(process.env.GITHUB_WORKSPACE || '', dirPath, jsonFileName) :
      path.join(process.env.GITHUB_WORKSPACE || '', jsonFileName);

    // Build the API path
    const apiPath = dirPath ? `${dirPath}/${jsonFileName}` : jsonFileName;

    if (fs.existsSync(filePath)) { // File exists locally, read from the local file system
      console.log(`Found dagger.json at ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      let data;

      try {
        data = JSON.parse(content);

        if (!data.engineVersion) {
          core.setFailed('Error: "engineVersion" field is missing in local dagger.json.');
        } else {
          core.setOutput('version', data.engineVersion);
          console.log(`Version obtained from local file: ${data.engineVersion}`);
        }
      } catch (parseError) {
        core.setFailed(`Error parsing local dagger.json at ${filePath}: ${parseError.message}`);
      }
    } else { // File doesn't exist locally, fetch using GitHub API
      console.log(`Local dagger.json not found at ${filePath}. Fetching via GitHub API...`);

      try {
        const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
        const octokit = github.getOctokit(token);
        const context = github.context;

        const response = await octokit.rest.repos.getContent({
          owner: context.repo.owner,
          repo: context.repo.repo,
          path: apiPath,
          ref: context.ref,
        });

        // The content is base64 encoded
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        let data;

        try {
          data = JSON.parse(content);

          if (!data.engineVersion) {
            core.setFailed(`Error: "engineVersion" field is missing in dagger.json fetched via API.`);
          } else {
            core.setOutput('version', data.engineVersion);
            console.log(`Version obtained from GitHub API: ${data.engineVersion}`);
          }
        } catch (parseError) {
          core.setFailed(`Error parsing dagger.json fetched via API: ${parseError.message}`);
        }
      } catch (error) {
        if (error.status === 404) {
          core.setFailed(`Error: dagger.json not found at path ${apiPath} via GitHub API.`);
        } else {
          core.setFailed(`An error occurred while fetching dagger.json via API: ${error.message}`);
        }
      }
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

run();
