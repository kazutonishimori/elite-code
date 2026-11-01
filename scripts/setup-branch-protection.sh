#!/usr/bin/env bash
# Applies branch protection to `main`: PRs required, every CI job must pass, and the branch
# must be up to date with main before merging. Requires an authenticated `gh` with admin rights.
#
#   scripts/setup-branch-protection.sh [owner/repo]
set -euo pipefail

repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

# Must match the job `name:` values in .github/workflows/ci.yml.
checks=(lint typecheck "unit + component tests" pytest "problem validation" e2e build)

contexts=$(printf '%s\n' "${checks[@]}" | jq -R . | jq -s .)

jq -n --argjson contexts "$contexts" '{
  required_status_checks: { strict: true, contexts: $contexts },
  enforce_admins: false,
  required_pull_request_reviews: { required_approving_review_count: 0, dismiss_stale_reviews: true },
  restrictions: null,
  required_conversation_resolution: true,
  allow_force_pushes: false,
  allow_deletions: false
}' | gh api --method PUT "repos/${repo}/branches/main/protection" --input - >/dev/null

echo "Branch protection applied to ${repo}@main:"
gh api "repos/${repo}/branches/main/protection" \
  --jq '{strict: .required_status_checks.strict, checks: .required_status_checks.contexts, pull_requests_required: (.required_pull_request_reviews != null), enforce_admins: .enforce_admins.enabled}'
