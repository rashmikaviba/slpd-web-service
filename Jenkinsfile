pipeline {
    agent any

    environment {
        GHCR_CRED = credentials('my-github-login')
        IMAGE_NAME = "ghcr.io/nimna-thiranjaya/slpd-web-service"
    }

    parameters {
        string(name: 'BRANCH_NAME', defaultValue: 'implement-cicd', description: 'Branch to build')
        string(name: 'IMAGE_TAG', defaultValue: '1.0.0.6', description: 'Docker image tag')

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
                    def imageName = "${IMAGE_NAME}:${params.IMAGE_TAG}"

                    // Clean up any existing Docker image
                    sh "docker rmi -f ${imageName} || true"

                    // Build image using Jenkins Docker plugin
                    def img = docker.build(imageName)
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
                }
            }
        }
    }
}
