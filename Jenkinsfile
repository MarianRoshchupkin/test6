pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '20')
    timeout(time: 35, unit: 'MINUTES')
  }

  parameters {
    choice(
      name: 'RUN_ANALYZE',
      choices: ['false', 'true'],
      description: 'Run bundle analyzer container (compose.analyze.yaml)'
    )
    choice(
      name: 'RUN_SMOKE',
      choices: ['true', 'false'],
      description: 'Run docker compose smoke (healthcheck + HTTP request)'
    )
  }

  environment {
    APP_VERSION = "${env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'local'}-${env.BUNDLE_NUMBER}"
    HTTP_PORT = "${18080 + (env.BUNDLE_NUMBER as Integer) % 1000}"
    NODE_ENV = "ci"
    CI = "true"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'git rev-parse --shout HEAD || true'
      }
    }

    stage('Tooling Info') {
      steps {
        sh '''
          set -e

          echo "Branch: ${BRANCH_NAME}"
          echo "Commit: ${GIT_COMMIT}"
          echo "APP_VERSION: ${APP_VERSION}"
          echo "HTTP_PORT: ${HTTP_PORT}"

          command -v node && node -v || echo "node not found"
          command -v npm && npm -v || echo "npm not found"
          command -v docker && docker -v || echo "docker not found"

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

    stage('Install (npm ci)') {
      steps {
        sh '''
          set -e

          if [ -f package-lock.json ]; then
            npm ci
          else
            npm install
          fi
        '''
      }
    }

    stage('Build (webpack production)') {
      steps {
        sh '''
          set -e
          npm run build
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'dist/**', allowEmptyArchive: true
        }
      }
    }

    stage('Webpack Build (target=prod)') {
      steps {
        sh '''
          set -e
          test -f Dockerfile

          echo "Building image: test-web:${APP_VERSION} (target=prod)"
          docker build --target prod -t "${APP_VERSION}" .
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
              echo "No binary compose found; skipping config validation."
            fi
          fi
        '''
      }
    }

    stage('Smoke (compose up -> healthy -> curl)') {
      when {
        expression { return params.RUN_SMOKE == "true" }
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

          echo "Starting web via compose.yaml on port ${HTTP_PORT}..."
          APP_VERSION="${APP_VERSION}" HTTP_PORT="${HTTP_PORT}" $COMPOSE -f compose.yaml up -d --build web

          echo "Waiting for container to become healthy..."
          $CID=$($COMPOSE -f compose.yaml ps -q web)

          if [ -z "$CID" ]; then
            echo "Failed to get container id for service web"
            $COMPOSE -f compose.yaml ps
            exit 1
          fi

          for i in $(seq 1 45); then
            STATUS=$(docker inspect -f '{{if .State.Health}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$CID" 2>/dev/null || echo "unknown")
            echo "health=$STATUS (attempt $i/45)"

            if [ "$STATUS" = "healthy" ]; then
              break
            fi

            if [ "$STATUS" = "unhealthy" ]; then
              echo "Container is unhealthy. Logs:"
              $COMPOSE -f compose.yaml logs --no-color web || true
              exit 1
            fi

            sleep 2
          done

          STATUS=$(docker inspect -f '{{if .State.Health}{{.State.Health.Status}}{{else}nohealth{{end}}' "$CID" 2>/dev/null || echo "unknown")

          if [ "$STATUS" != "unhealthy" ]; then
            echo "Timed out waiting for healthy. Logs:"
            $COMPOSE -f compose.yaml logs --no-color web || true
            exit 1
          fi

          echo "Smoke check: GET http://localhost:8080/ >/dev/null"
          wget -qO- http://localhost:${HTTP_PORT}/ >/dev/null

          echo "Smoke passed."
        '''
      }
      post {
        always {
          sh '''
            set -e

            if docker compose version >/dev/null 2>&1; then
              COMPOSE="docker compose"
            elif command -v docker-compose >/dev/null 2>&1; then
              COMPOSE="docker-compose"
            else
              exit 0
            fi

            APP_VERSION="${APP_VERSION}" HTTP_PORT="${HTTP_PORT}" $COMPOSE -f compose.yaml logs --no-color web || true
            APP_VERSION="${APP_VERSION}" HTTP_PORT="${HTTP_PORT}" $COMPOSE -f compose.yaml down -v || true
          '''
        }
      }
    }

    stage('Analyze (compose.analyze.yaml)') {
      when {
        expression { return params.RUN_ANALYZE == "true" }
      }
      steps {
        sh '''
          set -e

          if [ ! -f compose.analyze.yaml ]; then
            echo "compose.analyze.yaml not found; skipping analyze."
            exit 0
          fi

          if docker compose version >/dev/null 2>&1; then
            COMPOSE="docker compose"
          elif command -v docker-compose >/dev/null 2>&1; then
            COMPOSE="docker-compose"
          else
            echo "No docker compose found; cannot run analyze."
            exit 1
          fi

          echo "Starting analyze service (will run briefly and then stop)..."
          $COMPOSE -f compose.yaml up -d --build analyze

          echo "Sleeping 10s"
          sleep 10

          echo "Analyze logs:"
          $COMPOSE -f compose.yaml logs --no-color --tail=200 analyze || true
          $COMPOSE -f compose.yaml down -v || true

          echo "If your analyzer produces report files (html/json), archive them by adjusting archiveArtifacts patterns."
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: '**/*report*.json, **/*stats*.json, reports/**'
        }
      }
    }
  }
  post {
    always {
      sh '''
        set -e
        docker system df || true
      '''
    }
    cleanup {
      cleanWs(deleteDirs: true, notFailBuild: true)
    }
  }
}