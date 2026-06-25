def jiraRestComment(String message) {
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

pipeline {
    agent any

    environment {
        JIRA_ISSUE = 'DEVOPS-2'
        JIRA_BASE_URL = 'https://waleedo020.atlassian.net'
        JIRA_SITE = 'waleedo020.atlassian.net'
        JIRA_CREDS = 'jira-cloud'
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

        stage('JMeter Report Placeholder') {
            steps {
                echo 'JMeter test plan is available at test/load-test.jmx.'
                echo 'Install JMeter on the Jenkins agent before enabling automated load-test execution.'
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
