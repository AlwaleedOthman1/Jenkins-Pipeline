# DevOps Assignment App

Simple Node.js app for testing this flow:

GitHub push -> Jenkins auto-build -> Jenkins updates Jira -> Jenkins builds Docker image -> Jenkins pushes image to Docker Hub.

## Run Locally

```powershell
npm install
npm test
npm start
```

Open:

```text
http://localhost:3000
http://localhost:3000/health
```

## Docker


```powershell
docker build -t yourdockerhubusername/devops-assignment-app:latest .
docker run -p 3000:3000 yourdockerhubusername/devops-assignment-app:latest
```

## Jenkins Setup Notes

Before running the pipeline, update these values in `Jenkinsfile`:

- `JIRA_ISSUE`: your Jira issue key, for example `DEVOPS-1`
- `JIRA_BASE_URL`: your Jira Cloud URL, for example `https://your-site.atlassian.net`
- `JIRA_SITE`: your Jira Cloud site for Jenkins build info, for example `your-site.atlassian.net`
- `JIRA_CREDS`: Jenkins credential ID for Jira Cloud, expected as `jira-cloud`
- `DOCKER_IMAGE`: your Docker Hub image, for example `yourdockerhubusername/devops-assignment-app`
- `DOCKER_CREDS`: Jenkins credential ID for Docker Hub, expected as `dockerhub`

Create the `jira-cloud` Jenkins credential as:

- Kind: Username with password
- Username: your Atlassian account email
- Password: Atlassian API token
- ID: `jira-cloud`

Required Jenkins plugins:

- Git
- GitHub
- Pipeline
- Docker Pipeline
- Credentials Binding
- Jira
- Atlassian Jira Software Cloud
- HTML Publisher
- Performance Plugin

Use a branch name and commit message containing the Jira issue key, for example:

```powershell
git checkout -b DEVOPS-1-jenkins-pipeline
git add .
git commit -m "DEVOPS-1 add Jenkins pipeline and Dockerfile"
git push origin DEVOPS-1-jenkins-pipeline
```

## JMeter

A basic JMeter test plan is included at `test/load-test.jmx`. It targets:

```text
http://localhost:3000/health
```

The Jenkins pipeline downloads Apache JMeter 5.6.3 into the workspace if it is not already present, starts the Node.js app on `localhost:3000`, and runs:

```powershell
test/load-test.jmx
```

Jenkins publishes:

- `reports/jmeter/results.jtl` through the Performance Plugin
- `reports/jmeter/html/index.html` through HTML Publisher
- all files under `reports/jmeter/` as archived artifacts

Required Jenkins plugins:

- HTML Publisher
- Performance Plugin

The Jenkins agent also needs Java available because JMeter runs on Java.
## Jira Issue Detection

The pipeline detects the Jira issue key from the branch name or latest commit message. Put the issue key at the start of your commit message, for example:

```powershell
git commit -m "DEVOPS-4 update Jenkins pipeline"
```

After checkout, Jenkins uses the detected issue key for Jira comments. If the issue is currently `New` or `To Do`, the pipeline attempts to move it to `In Progress` or `Under Progress` using Jira REST API transitions.

The Jira credential user must have permission to browse the issue, add comments, and transition the issue.