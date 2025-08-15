pipeline {
    agent any

    environment {
        GHCR_CRED = credentials('my-github-login')
        IMAGE_NAME = "ghcr.io/nimna-thiranjaya/slpd-web-service"
        IMAGE_TAG = "ver_0.0.8"
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

    stage('Build Docker Image') {
        steps {
            sh 'docker build -t $IMAGE_NAME:$IMAGE_TAG .'
        }
    }

    stage('Login to GitHub Container Registry') {
        steps {
            withCredentials([usernamePassword(
                credentialsId: 'my-github-login',
                usernameVariable: 'GH_USERNAME',
                passwordVariable: 'GH_TOKEN'
            )]){
                sh 'echo $GH_TOKEN | docker login ghcr.io -u $GH_USERNAME --password-stdin'
            }
        }
    }

     stage('Push Docker Image') {
        steps {
            sh 'docker push $IMAGE_NAME:$IMAGE_TAG'
        }
    }

}

