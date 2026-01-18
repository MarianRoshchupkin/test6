pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '20'))
    timeout(time: 35, unit: 'MINUTES')
  }

  parameters {
    choice(
      name: 'RUN_ANALYZE',
      choices: ['false', 'true'],
      description: 'Run bundle analyzer container (Docker target=analyze)'
    )
    choice(
      name: 'RUN_SMOKE',
      choices: ['true', 'false'],
      description: 'Run docker compose smoke (healthcheck + HTTP request)'
    )
  }

  environment {
    CI = "true"
  }

  stages {
    stage('Init') {
      steps {
        script {
          def bn = (env.BUILD_NUMBER ?: '0').toInteger()
          def sha = (env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'local')

          env.APP_VERSION = "${sha}-${bn}"
          env.HTTP_PORT  = "${18081 + (bn % 1000)}"

          echo "Init: APP_VERSION=${env.APP_VERSION}"
          echo "Init: HTTP_PORT=${env.HTTP_PORT}"
        }
      }
    }

    stage('Checkout') {
      steps {
        checkout scm
        sh 'git rev-parse --short HEAD || true'
      }
    }

    stage('Tooling Info') {
      steps {
        sh '''
          set -e

          echo "Commit: ${GIT_COMMIT}"
          echo "APP_VERSION: ${APP_VERSION}"
          echo "HTTP_PORT: ${HTTP_PORT}"

          command -v docker && docker -v || { echo "docker not found"; exit 1; }

          if docker compose version >/dev/null 2>&1; then
            echo "docker compose (v2) available"
          elif command -v docker-compose >/dev/null 2>&1; then
            echo "docker-compose (v1) available"
          else
            echo "No docker compose found"
          fi
        '''
      }
    }

    stage('Docker Build (prod image)') {
      steps {
        sh '''
          set -e
          test -f Dockerfile

          echo "Building image: test-web:${APP_VERSION} (target=prod)"
          docker build --target prod -t "test-web:${APP_VERSION}" .
        '''
      }
    }

    stage('Compose Validate') {
      steps {
        sh '''
          set -e

          if [ -f compose.yaml ]; then
            if docker compose version >/dev/null 2>&1; then
              APP_VERSION="${APP_VERSION}" HTTP_PORT="${HTTP_PORT}" docker compose -f compose.yaml config >/dev/null
            elif command -v docker-compose >/dev/null 2>&1; then
              APP_VERSION="${APP_VERSION}" HTTP_PORT="${HTTP_PORT}" docker-compose -f compose.yaml config >/dev/null
            else
              echo "No compose binary found; skipping config validation."
            fi
          fi
        '''
      }
    }

    stage('Smoke (compose up -> healthy -> wget)') {
      when {
        expression { return params.RUN_SMOKE == 'true' }
      }
      steps {
        sh '''
          set -e

          if docker compose version >/dev/null 2>&1; then
            COMPOSE="docker compose"
          elif command -v docker-compose >/dev/null 2>&1; then
            COMPOSE="docker-compose"
          else
            echo "No docker compose found; cannot run smoke."
            exit 1
          fi

          PROJECT="ci${BUILD_NUMBER}"
          echo "Compose project: $PROJECT"

          echo "Starting web via compose.yaml on port ${HTTP_PORT}..."
          APP_VERSION="${APP_VERSION}" HTTP_PORT="${HTTP_PORT}" $COMPOSE -p "$PROJECT" -f compose.yaml up -d --build web

          echo "Waiting for container to become healthy..."
          CID=$($COMPOSE -p "$PROJECT" -f compose.yaml ps -q web)

          if [ -z "$CID" ]; then
            echo "Failed to get container id for service web"
            $COMPOSE -p "$PROJECT" -f compose.yaml ps
            exit 1
          fi

          for i in $(seq 1 45); do
            STATUS=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$CID" 2>/dev/null || echo "unknown")
            echo "health=$STATUS (attempt $i/45)"

            if [ "$STATUS" = "healthy" ]; then
              break
            fi

            if [ "$STATUS" = "unhealthy" ]; then
              echo "Container is unhealthy. Logs:"
              $COMPOSE -p "$PROJECT" -f compose.yaml logs --no-color web || true
              exit 1
            fi

            sleep 2
          done

          STATUS=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$CID" 2>/dev/null || echo "unknown")
          if [ "$STATUS" != "healthy" ]; then
            echo "Timed out waiting for healthy. Current status: $STATUS"
            $COMPOSE -p "$PROJECT" -f compose.yaml logs --no-color web || true
            exit 1
          fi

          echo "HTTP smoke check via service DNS inside compose network: GET http://web:8080/"
          NET="${PROJECT}_default"

          # небольшая страховка от кратких гонок/ресолва
          for i in $(seq 1 10); do
            if docker run --rm --network "$NET" curlimages/curl:8.5.0 -fsS http://web:8080/ >/dev/null 2>&1; then
              echo "Smoke passed."
              exit 0
            fi
            echo "Smoke not ready yet (attempt $i/10); sleeping..."
            sleep 1
          done

          echo "Smoke failed after retries. Service logs:"
          $COMPOSE -p "$PROJECT" -f compose.yaml logs --no-color web || true
          exit 1
        '''
      }
      post {
        always {
          sh '''
            set +e

            if docker compose version >/dev/null 2>&1; then
              COMPOSE="docker compose"
            elif command -v docker-compose >/dev/null 2>&1; then
              COMPOSE="docker-compose"
            else
              exit 0
            fi

            PROJECT="ci${BUILD_NUMBER}"

            APP_VERSION="${APP_VERSION}" HTTP_PORT="${HTTP_PORT}" $COMPOSE -p "$PROJECT" -f compose.yaml logs --no-color web || true
            APP_VERSION="${APP_VERSION}" HTTP_PORT="${HTTP_PORT}" $COMPOSE -p "$PROJECT" -f compose.yaml down -v || true
          '''
        }
      }
    }

    stage('Analyze (Docker target=analyze)') {
      when {
        expression { return params.RUN_ANALYZE == 'true' }
      }
      steps {
        sh '''
          set -e
          test -f Dockerfile

          echo "Building analyze image: test-web-analyze:${APP_VERSION}"
          docker build --target analyze -t "test-web-analyze:${APP_VERSION}" .

          echo "Running analyze container briefly..."
          CID=$(docker run -d -p 18888:8888 "test-web-analyze:${APP_VERSION}")

          sleep 10

          docker logs --tail=200 "$CID" || true
          docker rm -f "$CID" || true

          echo "Analyze finished (logs captured)."
        '''
      }
    }
  }
  post {
    always {
      script {
        node {
          sh '''
            set +e
            docker system df || true
          '''
        }
      }
    }
    cleanup {
      script {
        node {
          cleanWs(deleteDirs: true, notFailBuild: true)
        }
      }
    }
  }
}