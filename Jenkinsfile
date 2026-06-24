pipeline {
    agent any

    environment {
        JIRA_ISSUE = 'DEVOPS-1'
        JIRA_SITE = 'https://waleedo020.atlassian.net/'
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
                jiraComment issueKey: "${env.JIRA_ISSUE}",
                            body: "Jenkins build started: ${env.BUILD_URL}"
            }
        }

        stage('Build and Test App') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'npm ci'
                        sh 'npm test'
                    } else {
                        bat 'npm ci'
                        bat 'npm test'
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
            jiraComment issueKey: "${env.JIRA_ISSUE}",
                        body: "Jenkins build SUCCESS. Docker image pushed: ${env.DOCKER_IMAGE}:latest"
        }

        failure {
            jiraComment issueKey: "${env.JIRA_ISSUE}",
                        body: "Jenkins build FAILED. Check console: ${env.BUILD_URL}"
        }
    }
}
