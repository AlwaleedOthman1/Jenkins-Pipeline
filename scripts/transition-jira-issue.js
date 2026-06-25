const https = require('https');

const requiredEnv = [
  'JIRA_BASE_URL',
  'JIRA_ISSUE',
  'JIRA_USER',
  'JIRA_TOKEN'
];

for (const name of requiredEnv) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

const baseUrl = process.env.JIRA_BASE_URL.replace(/\/$/, '');
const issueKey = process.env.JIRA_ISSUE;
const auth = Buffer.from(`${process.env.JIRA_USER}:${process.env.JIRA_TOKEN}`).toString('base64');

function requestJson(method, path, payload) {
  const body = payload ? JSON.stringify(payload) : null;
  const url = new URL(`${baseUrl}${path}`);

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
        }
      },
      (response) => {
        let responseBody = '';

        response.on('data', (chunk) => {
          responseBody += chunk;
        });

        response.on('end', () => {
          let json = null;

          if (responseBody) {
            try {
              json = JSON.parse(responseBody);
            } catch {
              json = responseBody;
            }
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}: ${responseBody}`));
            return;
          }

          resolve(json);
        });
      }
    );

    request.on('error', reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

async function main() {
  console.log(`Checking Jira status for ${baseUrl}/browse/${issueKey}`);

  const issue = await requestJson(
    'GET',
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=status`
  );

  const statusName = issue.fields?.status?.name;
  const normalizedStatus = normalize(statusName);
  console.log(`Current Jira status: ${statusName}`);

  if (!['new', 'todo'].includes(normalizedStatus)) {
    console.log('Jira issue is not New or To Do; leaving status unchanged.');
    return;
  }

  const transitionsResponse = await requestJson(
    'GET',
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`
  );

  const transition = transitionsResponse.transitions.find((candidate) => {
    const name = normalize(candidate.name);
    const target = normalize(candidate.to?.name);

    return [name, target].some((value) => ['inprogress', 'underprogress'].includes(value));
  });

  if (!transition) {
    const available = transitionsResponse.transitions.map((item) => `${item.name} -> ${item.to?.name}`).join(', ');
    throw new Error(`Could not find an In Progress/Under Progress transition. Available transitions: ${available}`);
  }

  await requestJson(
    'POST',
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    {
      transition: {
        id: transition.id
      }
    }
  );

  console.log(`Moved ${issueKey} to ${transition.to?.name || transition.name}.`);
}

main().catch((error) => {
  console.error(`Jira transition failed: ${error.message}`);
  console.error('Check JIRA_BASE_URL, the detected issue key, and whether the Jira credential user can browse and transition this issue.');
  process.exit(1);
});