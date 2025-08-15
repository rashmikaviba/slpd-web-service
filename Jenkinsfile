pipeline {
    agent any

    environment {
        GHCR_CRED = credentials('my-github-login')
        IMAGE_NAME = "ghcr.io/nimna-thiranjaya/slpd-web-service"
    }

    parameters {
        string(name: 'BRANCH_NAME', defaultValue: 'implement-cicd', description: 'Branch to build')
        string(name: 'IMAGE_TAG', defaultValue: 'ver_0.0.8', description: 'Docker image tag')

    }

    stages {
        stage('Checkout') {
            steps {
                git branch: "${params.BRANCH_NAME}",
                    url: 'https://github.com/rashmikaviba/slpd-web-service.git',
                    credentialsId: 'my-github-login'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    docker.build("slpd:latest")
                }
            }
        }
        

        stage('Build Docker Image') {
            steps {
               script {
                    // Build image using Jenkins Docker plugin
                    def img = docker.build("${IMAGE_NAME}:${params.IMAGE_TAG}")
                    echo "Built Docker image: ${img.id}"
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                script {
                    // Use credentials to login to GHCR and push
                    docker.withRegistry('https://ghcr.io', 'my-github-login') {
                        def img = docker.image("${IMAGE_NAME}:${params.IMAGE_TAG}")
                        img.push()
                        echo "Pushed Docker image: ${IMAGE_NAME}:${params.IMAGE_TAG}"
                    }

                    // delete the local image after pushing
                    def img = docker.image("${IMAGE_NAME}:${params.IMAGE_TAG}")
                    img.remove()
                    echo "Removed local Docker image: ${IMAGE_NAME}:${params.IMAGE_TAG}"
                }
            }
        }
    }
}

