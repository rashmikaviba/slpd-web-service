pipeline {
    agent any

    // environment {
    //     GHCR_USERNAME = credentials('my-github-login') // GitHub username
    //     GHCR_TOKEN = credentials('ghcr-token')       // GitHub PAT
    //     IMAGE_NAME = "ghcr.io/${GHCR_USERNAME}/node-app"
    // }

    stages {
        stage('Checkout') {
            steps {
                // git branch: 'main', url: 'https://github.com/USERNAME/REPO.git'
                checkout scm
            }
        }

        // stage('Build Docker Image') {
        //     steps {
        //         sh 'docker build -t $IMAGE_NAME:latest .'
        //     }
        // }
    }
}
