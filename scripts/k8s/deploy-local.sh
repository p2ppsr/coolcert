#!/usr/bin/env bash
set -euo pipefail

if [[ "${ENVIRONMENT:-}" != "prod" && "${ENVIRONMENT:-}" != "production" ]]; then
  echo "ENVIRONMENT=prod is required" >&2
  exit 2
fi

if [[ -z "${IMAGE_TAG:-}" ]]; then
  if [[ -z "${SOURCE_SHA:-}" ]]; then
    echo "IMAGE_TAG or SOURCE_SHA is required" >&2
    exit 2
  fi
  IMAGE_TAG="${SOURCE_SHA:0:12}-prod-$(date -u +%F)"
fi

repo_root="$(git rev-parse --show-toplevel)"
registry_pull="${REGISTRY_PULL:-registry.cars-operator-system.svc.cluster.local:5000}"
kubectl_cmd="${KUBECTL:-kubectl}"
tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "${tmp_dir}"; }
trap cleanup EXIT

mkdir -p "${tmp_dir}/infra"
cp -R "${repo_root}/infra/kubernetes" "${tmp_dir}/infra/kubernetes"

overlay_dir="${tmp_dir}/infra/kubernetes/overlays/prod"
kustomization="${overlay_dir}/kustomization.yaml"

export IMAGE_TAG REGISTRY_PULL="${registry_pull}"
perl -0pi -e 's#newName: [^\n]*/p2ppsr/coolcert#newName: $ENV{REGISTRY_PULL}/p2ppsr/coolcert#g' "${kustomization}"
perl -0pi -e 's#newTag: [^\n]+#newTag: $ENV{IMAGE_TAG}#g' "${kustomization}"

"${kubectl_cmd}" apply -f "${overlay_dir}/namespace.yaml"
"${kubectl_cmd}" kustomize "${overlay_dir}" | "${kubectl_cmd}" apply -f -
"${kubectl_cmd}" -n coolcert-prod rollout status deployment/coolcert --timeout=15m
"${kubectl_cmd}" -n coolcert-prod wait --for=condition=Ready certificate/coolcert-tls --timeout=15m

"${kubectl_cmd}" -n coolcert-prod run "coolcert-smoke-$(date +%s)" \
  --quiet \
  --rm \
  -i \
  --restart=Never \
  --image=curlimages/curl:8.11.1 \
  --command -- curl --fail --show-error --silent http://coolcert:8080/healthz

printf 'coolcert prod deployment completed for image tag %s\n' "${IMAGE_TAG}"
