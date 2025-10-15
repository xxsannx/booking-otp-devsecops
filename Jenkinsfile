pipeline {
  agent any

  environment {
    PORT = '3000'
    GMAIL_USER = credentials('zainul.ariffinihsan@gmail.com')   // create secret text or username credentials in Jenkins
    GMAIL_PASS = credentials('Testing01.')   // same: create secret text in Jenkins
  }

  tools {
    nodejs 'Node20'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Dependencies') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Lint') {
      steps {
        sh 'npm run lint'
      }
    }

    stage('Unit Tests') {
      steps {
        sh 'npm test'
      }
    }

    stage('Dependency Scan') {
      steps {
        sh 'npm audit --audit-level=moderate || true'
      }
    }

    stage('SAST - Semgrep') {
      steps {
        sh '''
          pip install --user semgrep
          ~/.local/bin/semgrep --config p/owasp-top-ten || true
        '''
      }
    }

    stage('Build Docker Image') {
      steps {
        sh 'docker build -t booking-otp:jenkins .'
      }
    }

    stage('DAST - OWASP ZAP (baseline)') {
      steps {
        // start container in background (expose port)
        sh '''
          docker rm -f booking-otp-test || true
          docker run -d --name booking-otp-test -p 3000:3000 -e GMAIL_USER=${GMAIL_USER} -e GMAIL_PASS=${GMAIL_PASS} booking-otp:jenkins
          sleep 5
        '''
        // run ZAP baseline
        sh '''
          docker run --rm --network host -v $(pwd):/zap/wrk/:rw owasp/zap2docker-stable zap-baseline.py -t http://localhost:3000 -r zap-report.html || true
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'zap-report.html', allowEmptyArchive: true
          sh 'docker rm -f booking-otp-test || true'
        }
      }
    }

    stage('Image Scan - Trivy') {
      steps {
        sh '''
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --severity HIGH,CRITICAL booking-otp:jenkins || true
        '''
      }
    }

    stage('Deploy (local)') {
      steps {
        sh '''
          docker rm -f booking-otp || true
          docker run -d --name booking-otp -p 3000:3000 --env GMAIL_USER=${GMAIL_USER} --env GMAIL_PASS=${GMAIL_PASS} booking-otp:jenkins
        '''
      }
    }
  }

  post {
    success {
      echo 'Pipeline sukses ✅'
    }
    failure {
      echo 'Pipeline gagal ❌'
    }
  }
}
