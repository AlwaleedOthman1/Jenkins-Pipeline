def detectJiraIssue() {
    def sources = [env.BRANCH_NAME, env.GIT_BRANCH, env.CHANGE_BRANCH].findAll { it }

    for (source in sources) {
        def matcher = source =~ /([A-Z][A-Z0-9]+-[0-9]+)/
        if (matcher.find()) {
            return matcher.group(1)
        }
    }

    def commitMessage = isUnix()
        ? sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
        : powershell(script: 'git log -1 --pretty=%B', returnStdout: true).trim()

    def matcher = commitMessage =~ /^([A-Z][A-Z0-9]+-[0-9]+)\b|\b([A-Z][A-Z0-9]+-[0-9]+)\b/
    if (matcher.find()) {
        return matcher.group(1) ?: matcher.group(2)
    }

    error 'No Jira issue key found. Start the commit message or branch name with an issue key, for example: DEVOPS-4 update pipeline.'
}

def jiraRestComment(String message) {
    if (!env.JIRA_ISSUE?.trim()) {
        echo 'No Jira issue key detected; skipping Jira comment.'
        return
    }

    catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
        withCredentials([usernamePassword(
            credentialsId: "${env.JIRA_CREDS}",
            usernameVariable: 'JIRA_USER',
            passwordVariable: 'JIRA_TOKEN'
        )]) {
            withEnv(["JIRA_COMMENT=${message}"]) {
                if (isUnix()) {
                    sh 'node scripts/post-jira-comment.js'
                } else {
                    powershell '''
                    node scripts/post-jira-comment.js
                    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                    '''
                }
            }
        }
    }
}

def jiraMoveToInProgressIfNeeded() {
    if (!env.JIRA_ISSUE?.trim()) {
        echo 'No Jira issue key detected; skipping Jira transition.'
        return
    }

    catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
        withCredentials([usernamePassword(
            credentialsId: "${env.JIRA_CREDS}",
            usernameVariable: 'JIRA_USER',
            passwordVariable: 'JIRA_TOKEN'
        )]) {
            if (isUnix()) {
                sh 'node scripts/transition-jira-issue.js'
            } else {
                powershell '''
                node scripts/transition-jira-issue.js
                if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                '''
            }
        }
    }
}
pipeline {
    agent any

    environment {
        JIRA_BASE_URL = 'https://waleedo020.atlassian.net'
        JIRA_SITE = 'waleedo020.atlassian.net'
        JIRA_CREDS = 'jira-cloud'
        JMETER_VERSION = '5.6.3'
        DOCKER_IMAGE = 'theboss123/devops-assignment-app'
        DOCKER_CREDS = 'dockerhub'
    }

    triggers {
        githubPush()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Detect Jira Issue') {
            steps {
                script {
                    env.JIRA_ISSUE = detectJiraIssue()
                    echo "Detected Jira issue: ${env.JIRA_ISSUE}"
                }
            }
        }

        stage('Jira Update - Move To In Progress') {
            steps {
                script {
                    jiraMoveToInProgressIfNeeded()
                }
            }
        }

        stage('Jira Update - Build Started') {
            steps {
                echo "Build started for ${env.JIRA_ISSUE}"
                script {
                    jiraRestComment("Jenkins build started: ${env.BUILD_URL}")
                }
            }
        }

        stage('Build and Test App') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'npm ci'
                        sh 'npm test'
                    } else {
                        powershell '''
                        npm.cmd ci
                        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                        npm.cmd test
                        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                        '''
                    }
                }
            }
            post {
                always {
                    jiraSendBuildInfo site: "${env.JIRA_SITE}"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    if (isUnix()) {
                        sh "docker build -t ${env.DOCKER_IMAGE}:${env.BUILD_NUMBER} -t ${env.DOCKER_IMAGE}:latest ."
                    } else {
                        bat "docker build -t %DOCKER_IMAGE%:%BUILD_NUMBER% -t %DOCKER_IMAGE%:latest ."
                    }
                }
            }
        }

        stage('Prepare JMeter') {
            steps {
                script {
                    if (isUnix()) {
                        sh '''
                        set -e
                        JMETER_DIR="tools/apache-jmeter-${JMETER_VERSION}"
                        JMETER_BIN="$JMETER_DIR/bin/jmeter"

                        if [ ! -x "$JMETER_BIN" ]; then
                            mkdir -p tools
                            curl -L "https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${JMETER_VERSION}.tgz" -o "tools/apache-jmeter-${JMETER_VERSION}.tgz"
                            tar -xzf "tools/apache-jmeter-${JMETER_VERSION}.tgz" -C tools
                        fi

                        "$JMETER_BIN" --version
                        '''
                    } else {
                        powershell '''
                        $ErrorActionPreference = 'Stop'
                        $jmeterDir = "tools/apache-jmeter-$env:JMETER_VERSION"
                        $jmeterBin = Join-Path $jmeterDir 'bin/jmeter.bat'

                        if (-not (Test-Path $jmeterBin)) {
                            New-Item -ItemType Directory -Force -Path 'tools' | Out-Null
                            $zipPath = "tools/apache-jmeter-$env:JMETER_VERSION.zip"
                            $url = "https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-$env:JMETER_VERSION.zip"
                            Invoke-WebRequest -Uri $url -OutFile $zipPath
                            Expand-Archive -Path $zipPath -DestinationPath 'tools' -Force
                        }

                        & $jmeterBin --version
                        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                        '''
                    }
                }
            }
        }

        stage('Run JMeter Load Test') {
            steps {
                script {
                    if (isUnix()) {
                        sh '''
                        set -e
                        rm -rf reports/jmeter/html reports/jmeter/results.jtl
                        mkdir -p reports/jmeter

                        node src/server.js > reports/jmeter/app.out.log 2> reports/jmeter/app.err.log &
                        APP_PID=$!
                        trap 'kill $APP_PID || true' EXIT

                        for i in $(seq 1 15); do
                            if curl -fsS http://localhost:3000/health > /dev/null; then
                                break
                            fi
                            sleep 2
                        done

                        curl -fsS http://localhost:3000/health > /dev/null
                        tools/apache-jmeter-${JMETER_VERSION}/bin/jmeter -n -t test/load-test.jmx -l reports/jmeter/results.jtl -e -o reports/jmeter/html
                        '''
                    } else {
                        powershell '''
                        $ErrorActionPreference = 'Stop'
                        Remove-Item -Recurse -Force -Path 'reports/jmeter/html' -ErrorAction SilentlyContinue
                        Remove-Item -Force -Path 'reports/jmeter/results.jtl' -ErrorAction SilentlyContinue
                        New-Item -ItemType Directory -Force -Path 'reports/jmeter' | Out-Null

                        $app = Start-Process -FilePath 'node' -ArgumentList 'src/server.js' -PassThru -WindowStyle Hidden -RedirectStandardOutput 'reports/jmeter/app.out.log' -RedirectStandardError 'reports/jmeter/app.err.log'

                        try {
                            $ready = $false
                            for ($i = 0; $i -lt 15; $i++) {
                                try {
                                    $response = Invoke-WebRequest -Uri 'http://localhost:3000/health' -UseBasicParsing -TimeoutSec 2
                                    if ($response.StatusCode -eq 200) {
                                        $ready = $true
                                        break
                                    }
                                } catch {
                                    Start-Sleep -Seconds 2
                                }
                            }

                            if (-not $ready) {
                                throw 'Node app did not become ready at http://localhost:3000/health'
                            }

                            $jmeterBin = "tools/apache-jmeter-$env:JMETER_VERSION/bin/jmeter.bat"
                            & $jmeterBin -n -t 'test/load-test.jmx' -l 'reports/jmeter/results.jtl' -e -o 'reports/jmeter/html'
                            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                        } finally {
                            if ($app -and -not $app.HasExited) {
                                Stop-Process -Id $app.Id -Force
                            }
                        }
                        '''
                    }
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/jmeter/**/*', allowEmptyArchive: true
                    publishHTML(target: [
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'reports/jmeter/html',
                        reportFiles: 'index.html',
                        reportName: 'JMeter HTML Report'
                    ])
                    perfReport sourceDataFiles: 'reports/jmeter/results.jtl'
                }
            }
        }

        stage('Push Docker Image to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: "${env.DOCKER_CREDS}",
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    script {
                        if (isUnix()) {
                            sh '''
                            set -e
                            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                            docker push "$DOCKER_IMAGE:$BUILD_NUMBER"
                            docker push "$DOCKER_IMAGE:latest"
                            '''
                        } else {
                            bat '''
                            powershell -NoProfile -Command "$env:DOCKER_PASS | docker login -u $env:DOCKER_USER --password-stdin"
                            if errorlevel 1 exit /b 1
                            docker push %DOCKER_IMAGE%:%BUILD_NUMBER%
                            if errorlevel 1 exit /b 1
                            docker push %DOCKER_IMAGE%:latest
                            if errorlevel 1 exit /b 1
                            '''
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            script {
                jiraRestComment("Jenkins build SUCCESS. Docker image pushed: ${env.DOCKER_IMAGE}:latest")
            }
        }

        failure {
            script {
                jiraRestComment("Jenkins build FAILED. Check console: ${env.BUILD_URL}")
            }
        }
    }
}
