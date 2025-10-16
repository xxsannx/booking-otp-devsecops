pipeline {
    agent any

    tools {
        nodejs 'Node20'
    }

    environment {
        APP_NAME = "booking-otp"
        DOCKER_IMAGE = "xxsannx/booking-otp:latest"   // Ganti "xxsannx" dgn username Docker Hub kamu
        DOCKERHUB_CRED = credentials('dockerhub_cred')
        EMAIL_USER = credentials('gmail_user')
        EMAIL_PASS = credentials('gmail_pass')
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo "📥 Cloning repository..."
                git branch: 'main', url: 'https://github.com/xxsannx/booking-otp-devsecops.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                echo "📦 Installing dependencies..."
                sh 'npm install'
            }
        }

        stage('Security Scan') {
            steps {
                echo "🕵️ Running npm audit for vulnerabilities..."
                sh 'npm audit --audit-level=moderate || true'
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "🐳 Building Docker image..."
                sh 'docker build -t ${DOCKER_IMAGE} .'
            }
        }

        stage('Push Docker Image') {
            steps {
                echo "🚀 Pushing image to Docker Hub..."
                withDockerRegistry([ credentialsId: 'dockerhub_cred', url: '' ]) {
                    sh 'docker push ${DOCKER_IMAGE}'
                }
            }
        }

        stage('Deploy & Run Container') {
            steps {
                echo "🧱 Deploying container locally..."
                sh '''
                    docker rm -f ${APP_NAME} || true
                    docker run -d -p 3000:3000 --name ${APP_NAME} ${DOCKER_IMAGE}
                '''
            }
        }

        stage('Notify Success') {
            steps {
                echo "✅ Build & Deployment successful!"
            }
        }
    }

    post {
        failure {
            echo '❌ Build failed. Please check logs for errors.'
        }
    }
}
