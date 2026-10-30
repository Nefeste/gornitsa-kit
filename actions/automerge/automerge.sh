#!/usr/bin/env bash
# Автослияние PR по метке «ревью: ок» (ADR студии 0018). Логика — из votchina:
# .github/workflows/automerge.yml @ fe98c02; здесь — параметрами вместо констант.
#
# Окружение: GH_TOKEN (токен слияния), BOT_TOKEN (токен Actions — комментарии и метки),
# OWN_TOKEN (true, если слияние идёт личным токеном владельца), LABEL, CHECK, MARK, ACTION,
# ADDED, MAIN, CODEOWNERS (путь к файлу из main), DISPATCH (workflow через пробел),
# DISPATCH_PATHS (регулярное выражение путей для них), OWNED_JS (путь к owned.mjs).
set -euo pipefail
R="$GITHUB_REPOSITORY"
if [ "$GITHUB_EVENT_NAME" = pull_request_target ]; then
  PRS="$(jq -r '.pull_request.number' "$GITHUB_EVENT_PATH")"
else
  PRS="$(jq -r '.workflow_run.pull_requests[].number' "$GITHUB_EVENT_PATH")"
  # список бывает пустым и для веток своего репозитория — ищем PR по ветке
  if [ -z "$PRS" ]; then
    BR="$(jq -r '.workflow_run.head_branch' "$GITHUB_EVENT_PATH")"
    PRS="$(gh api "repos/$R/pulls?state=open&head=${R%%/*}:$BR" --jq '.[].number')"
  fi
fi
# комментарии и метки — всегда от бота Actions: по автору бот узнаёт свою отметку
say() { GH_TOKEN="$BOT_TOKEN" gh api "repos/$R/issues/$1/comments" -f body="$2

---
_Автослияние, \`Nefeste/gornitsa-kit\`_" > /dev/null || true; }

for N in $PRS; do
  echo "::group::PR #$N"
  PR="$(gh api "repos/$R/pulls/$N")"
  SHA="$(jq -r .head.sha <<< "$PR")"
  HAS="$(jq --arg l "$LABEL" '[.labels[].name] | index($l) != null' <<< "$PR")"
  if [ "$(jq -r .state <<< "$PR")" != open ] || [ "$(jq -r .head.repo.full_name <<< "$PR")" != "$R" ] || [ "$(jq -r .base.ref <<< "$PR")" != "$MAIN" ]; then
    echo "Закрыт, из форка или не в $MAIN — не трогаю"; echo "::endgroup::"; continue
  fi

  # новые коммиты после ревью — метка и auto-merge снимаются
  if [ "$ACTION" = synchronize ]; then
    if [ "$HAS" = true ]; then
      gh pr merge "$N" --repo "$R" --disable-auto > /dev/null 2>&1 || true
      GH_TOKEN="$BOT_TOKEN" gh api -X DELETE "repos/$R/issues/$N/labels/$(jq -rn --arg l "$LABEL" '$l|@uri')" > /dev/null 2>&1 || true
      say "$N" "Новые коммиты после «$LABEL» — метка и автослияние сняты: нужно новое ревью."
    fi
    echo "::endgroup::"; continue
  fi
  if [ "$ACTION" = unlabeled ]; then
    if [ "$HAS" != true ]; then gh pr merge "$N" --repo "$R" --disable-auto > /dev/null 2>&1 || true; fi
    echo "::endgroup::"; continue
  fi
  if [ "$HAS" != true ]; then echo "Метки «$LABEL» нет"; echo "::endgroup::"; continue; fi

  # метку только что поставили — одобрен коммит, который был головой PR в этот момент
  if [ "$ACTION" = labeled ] && [ "$ADDED" = "$LABEL" ]; then
    AT="$(jq -r '.pull_request.head.sha' "$GITHUB_EVENT_PATH")"
    say "$N" "«$LABEL» на коммите \`${AT:0:7}\`: сольётся сам, когда проверки PR зелёные и путей владельца нет. Новый коммит снимет метку.
<!-- $MARK: $AT -->"
  fi
  # последний одобренный коммит — из комментариев бота Actions
  OK="$(GH_TOKEN="$BOT_TOKEN" gh api --paginate "repos/$R/issues/$N/comments?per_page=100" --jq ".[] | select(.user.login == \"github-actions[bot]\") | .body" | grep -oE "<!-- $MARK: [0-9a-f]{40} -->" | tail -n1 | grep -oE '[0-9a-f]{40}' || true)"
  if [ "$OK" != "$SHA" ]; then
    echo "Метка одобрила ${OK:0:7}, а голова PR — ${SHA:0:7}: не сливаю"; echo "::endgroup::"; continue
  fi
  if [ "$(jq -r .draft <<< "$PR")" = true ]; then echo "Черновик"; echo "::endgroup::"; continue; fi

  # пути владельца: и новое имя файла, и старое (переименование тоже правка)
  if [ "$(jq -r .changed_files <<< "$PR")" -gt 3000 ]; then
    say "$N" "В PR больше 3000 файлов — GitHub не отдаёт такой список целиком, проверить пути владельца нельзя. Сливает владелец."
    echo "::endgroup::"; continue
  fi
  FILES="$(gh api --paginate "repos/$R/pulls/$N/files?per_page=100" --jq '.[] | .filename, (.previous_filename // empty)')"
  OWNED="$(node "$OWNED_JS" "$CODEOWNERS" <<< "$FILES")"
  if [ -n "$OWNED" ]; then
    echo "Пути владельца:"; echo "$OWNED"
    if [ "$ACTION" = labeled ] && [ "$ADDED" = "$LABEL" ]; then
      say "$N" "PR задевает пути владельца (\`.github/CODEOWNERS\`), поэтому сам не сливается — сливает владелец:
$(head -20 <<< "$OWNED" | sed 's/^/- `/; s/$/`/')"
    fi
    echo "::endgroup::"; continue
  fi

  # проверки на одобренном коммите: обязательная — зелёная, остальные — без провалов
  RUNS="$(gh api --paginate "repos/$R/commits/$SHA/check-runs?per_page=100" --jq '.check_runs[] | select(.name | test("Автослияние") | not) | {name, status, conclusion}' | jq -s .)"
  REQ="$(jq -r --arg c "$CHECK" '[.[] | select(.name == $c)] | if length == 0 then "none" elif all(.status == "completed" and .conclusion == "success") then "ok" elif any(.status != "completed") then "wait" else "fail" end' <<< "$RUNS")"
  BAD="$(jq -r '[.[] | select(.status == "completed" and (.conclusion | IN("failure","cancelled","timed_out","action_required","stale","startup_failure")))] | map(.name) | join(", ")' <<< "$RUNS")"
  PENDING="$(jq -r '[.[] | select(.status != "completed")] | length' <<< "$RUNS")"
  echo "«$CHECK»: $REQ; красные: ${BAD:-нет}; идут: $PENDING"
  if [ "$REQ" != ok ] || [ -n "$BAD" ] || [ "$PENDING" != 0 ]; then
    echo "Ещё не зелёный — вернусь, когда закончатся проверки PR"; echo "::endgroup::"; continue
  fi

  if OUT="$(gh pr merge "$N" --repo "$R" --auto --squash --match-head-commit "$SHA" 2>&1)"; then
    echo "$OUT"; echo "Auto-merge включён (squash)"
  else
    echo "$OUT"
    echo "Auto-merge не включился — сливаю сразу: метка на этом коммите, путей владельца нет, проверки зелёные"
    gh pr merge "$N" --repo "$R" --squash --match-head-commit "$SHA"
  fi

  # Слияние токеном Actions не запускает push-workflow (так устроен GitHub): нужные запускаются
  # здесь, если PR задел их пути. С личным токеном владельца они запустятся сами.
  # GitHub сливает по auto-merge не сразу — ждём до минуты (так делают «Сказы»).
  MERGED=false
  if [ -n "$DISPATCH" ] && [ "$OWN_TOKEN" != true ]; then
    for _ in $(seq 1 12); do
      MERGED="$(gh api "repos/$R/pulls/$N" --jq .merged)"
      [ "$MERGED" = true ] && break
      sleep 5
    done
    [ "$MERGED" = true ] || echo "PR ещё не слит — после слияния запустите $DISPATCH руками"
  fi
  if [ "$MERGED" = true ]; then
    if [ -z "$DISPATCH_PATHS" ] || grep -qE "$DISPATCH_PATHS" <<< "$FILES"; then
      for W in $DISPATCH; do gh workflow run "$W" --repo "$R" --ref "$MAIN" && echo "Запущен $W"; done
    fi
  fi
  echo "::endgroup::"
done
