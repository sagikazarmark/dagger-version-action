import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  try {
    // Get the path parameter (defaults to empty string which means root)
    const dirPath = core.getInput('path');
    console.log(`Input path parameter: "${dirPath}"`);

    // Debug environment
    console.log(`GITHUB_WORKSPACE: ${process.env.GITHUB_WORKSPACE}`);
    console.log(`Current working directory: ${process.cwd()}`);

    // List files in GITHUB_WORKSPACE for debugging
    console.log('Files in GITHUB_WORKSPACE:');
    try {
      const files = fs.readdirSync(process.env.GITHUB_WORKSPACE || '');
      files.forEach(file => {
        console.log(` - ${file}`);
      });
    } catch (error) {
      console.log(`Error listing files: ${error instanceof Error ? error.message : String(error)}`);
    }

    // If dirPath is provided, list files in that directory too
    if (dirPath) {
      const fullDirPath = path.join(process.env.GITHUB_WORKSPACE || '', dirPath);
      console.log(`Files in ${fullDirPath}:`);
      try {
        const files = fs.readdirSync(fullDirPath);
        files.forEach(file => {
          console.log(` - ${file}`);
        });
      } catch (error) {
        console.log(`Error listing files in ${fullDirPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Build the file path, joining the directory path if provided
    const jsonFileName = 'dagger.json';
    const filePath = dirPath ?
      path.join(process.env.GITHUB_WORKSPACE || '', dirPath, jsonFileName) :
      path.join(process.env.GITHUB_WORKSPACE || '', jsonFileName);

    console.log(`Looking for dagger.json at: ${filePath}`);

    // Build the API path
    const apiPath = dirPath ? `${dirPath}/${jsonFileName}` : jsonFileName;
    console.log(`API path would be: ${apiPath}`);

    if (fs.existsSync(filePath)) { // File exists locally, read from the local file system
      console.log(`Found dagger.json at ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`dagger.json content: ${content}`);
      let data;

      try {
        data = JSON.parse(content);

        if (!data.engineVersion) {
          core.setFailed('Error: "engineVersion" field is missing in local dagger.json.');
        } else {
          core.setOutput('version', data.engineVersion);
          console.log(`Version obtained from local file at: ${filePath}`);
        }
      } catch (parseError) {
        core.setFailed(`Error parsing local dagger.json at ${filePath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
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
        console.log(`dagger.json content from API: ${content}`);
        let data;

          data = JSON.parse(content);

          if (!data.engineVersion) {
            core.setFailed(`Error: "engineVersion" field is missing in dagger.json fetched via API from path: ${apiPath}`);
          } else {
            core.setOutput('version', data.engineVersion);
            console.log(`Version obtained from GitHub API from path: ${apiPath}`);
          }
        } catch (parseError) {
          core.setFailed(`Error parsing dagger.json fetched via API from path ${apiPath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      } catch (error: any) {
        console.log(`API error: ${JSON.stringify(error)}`);
        if (error.status === 404) {
          core.setFailed(`Error: dagger.json not found at path ${apiPath} via GitHub API.`);
        } else {
          core.setFailed(`An error occurred while fetching dagger.json via API from path ${apiPath}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();}