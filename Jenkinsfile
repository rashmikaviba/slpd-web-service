pipeline {
    agent any

    environment {
        GHCR_CRED = credentials('my-github-login')
    }

    parameters {
        string(name: 'BRANCH_NAME', defaultValue: 'implement-cicd', description: 'Branch to build')
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: "${params.BRANCH_NAME}",
                    url: 'https://github.com/rashmikaviba/slpd-web-service.git',
                    credentialsId: 'my-github-login'
            }
        }
    }
}

