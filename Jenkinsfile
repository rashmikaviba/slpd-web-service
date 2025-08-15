pipeline {
    agent any

  environment {
        GHCR_USERNAME = credentials('ghcr-username') 
        GHCR_TOKEN = credentials('ghcr-token')
        IMAGE_NAME = "ghcr.io/${GHCR_USERNAME}/node-app"
        GIT_BRANCH = 'implement-cicd' 
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: "${GIT_BRANCH}", url: 'https://github.com/USERNAME/REPO.git'
            }
        }

        // stage('Build Docker Image') {
        //     steps {
        //         sh 'docker build -t $IMAGE_NAME:latest .'
        //     }
        // }
    }
}
