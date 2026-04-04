# CrowdListen

> AI 에이전트에게 크라우드 컨텍스트를 제공합니다 — 실제 사용자가 말하는 것, 시장이 생각하는 것, 커뮤니티가 원하는 것에 대한 분석된 인텔리전스입니다.

![CrowdListen — Give your agent evidence, not guesses](docs/images/hero.png)

[English](README.md) | [中文文档](README-CN.md) | [한국어](README-KO.md) | [Español](README-ES.md)

## 문제

AI 에이전트는 사용자가 무엇을 생각하는지 모릅니다. 매 세션이 처음부터 시작됩니다 — Reddit에서 사람들이 뭐라고 하는지, TikTok 댓글의 신호, 포럼 토론의 종합 분석이 없습니다. 결국 피드백을 수동으로 복사 붙여넣기하고, 가장 중요한 입력인 실제 사람들의 생각 없이 에이전트가 결정을 내리는 것을 지켜보게 됩니다.

CrowdListen은 네 단계 루프로 이 문제를 해결합니다:

1. **리스닝** — Reddit, YouTube, TikTok, Twitter/X, Instagram, Xiaohongshu, 포럼 검색
2. **분석** — 주제별 의견 클러스터링, 페인 포인트 추출, 크로스 플랫폼 리포트 합성
3. **저장** — 인사이트를 .md 지식 베이스에 저장, 세션 간 지속적으로 축적
4. **리콜** — 시맨틱 검색으로 컨텍스트를 검색하거나 INDEX.md를 직접 탐색

모든 에이전트 — Claude Code, Cursor, Gemini CLI, Codex — 가 나중에 리콜할 수 있습니다. 인텔리전스는 세션과 에이전트를 넘어 축적됩니다. 이것이 크라우드 컨텍스트입니다.

## 시작하기

명령어 하나면 됩니다. 브라우저가 열리고, 로그인하면 에이전트가 자동으로 설정됩니다:

```bash
npx @crowdlisten/harness login
```

**Claude Code, Cursor, Gemini CLI, Codex, Amp, OpenClaw**에 MCP가 자동 설정됩니다. 환경 변수, JSON 편집, API 키 관리가 필요 없습니다. 로그인 후 에이전트를 재시작하세요.

### 수동 설정

에이전트의 MCP 설정에 추가:

```json
{
  "mcpServers": {
    "crowdlisten": {
      "command": "npx",
      "args": ["-y", "@crowdlisten/harness"]
    }
  }
}
```

원격 접근은 HTTP 전송 사용:

```json
{
  "mcpServers": {
    "crowdlisten": {
      "url": "https://mcp.crowdlisten.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## 할 수 있는 것

| 기능 | 설명 | 작동 방식 |
|------|------|-----------|
| **소셜 플랫폼 검색** | 하나의 도구로 Reddit, YouTube, TikTok, Twitter/X, Instagram, Xiaohongshu 검색 | 참여 지표, 타임스탬프, 작성자 정보가 포함된 구조화된 게시물 반환 — 플랫폼 무관 동일 형식 |
| **청중 신호 분석** | 의견 클러스터링, 페인 포인트 추출, 크로스 플랫폼 리포트 생성 | AI가 댓글을 주제별로 그���화, 감성 점수, 경쟁 신호 식별 |
| **세션 간 저장 및 리콜** | .md 지식 베이스가 에이전트와 디바이스를 넘어 축적 | `save`로 저장, `recall`로 검색, `~/.crowdlisten/context/INDEX.md` 탐색, `sync_context({ organize: true })`로 정리 |
| **작업 계획 및 추적** | 작업, 실행 계획, 진행 추적, 서버측 실행 | 에이전트가 작업 선점, 가정과 리스크 포함 계획 초안, 진행 기록, 실행 트리거 및 상태 폴링 |
| **전체 분석 실행** | 스트리밍 결과와 함께 엔드투엔드 크라우드 분석 | `run_analysis`로 백엔드 전체 파이프라인 트리거; `continue_analysis`로 후속 질문 |
| **크라우드 피드백에서 스펙 획득** | 크라우드 인텔리전스를 구현 가능한 스펙으로 전환 | 스펙에 증거 인용, 인수 기준, 신뢰도 점수 포함 |
| **웹사이트에서 추출** | 모든 URL을 스크린샷하고 구조화된 데이터 반환 | 비전 모드가 스크린샷을 LLM에 전송 — 포럼, 유료 사이트 등 모두 작동 |

## 작동 방식

![CrowdListen Pipeline — Raw Crowd Signals to Agent Delivery](docs/images/pipeline.jpg)

에이전트는 **7개의 코어 도구**로 시작하고 필요에 따라 스킬 팩을 활성화합니다 (전체 팩 합계 ~30개 도구). 재시작 불필요 — `tools/list_changed`를 통해 새 도구가 즉시 나타납니다.

**작업 실행** — 서버측 AI 에이전트 실행(Amp, Claude Code, Codex, Gemini CLI)을 트리거하고 MCP를 통해 진행 상황을 폴링합니다. `execute_task`로 작업을 배정하고 `get_execution_status`로 완료를 추적합니다.

### 스킬 팩

| 팩 | 도구 수 | 기능 |
|------|:-----:|-------------|
| **core** (항상 활성) | 7 | .md 지식 베이스 (save/recall/sync/publish), 스킬 발견, 환경설정 |
| **social-listening** | 7 | Reddit, TikTok, YouTube, Twitter, Instagram, Xiaohongshu 검색 |
| **audience-analysis** | 4 | 의견 클러스터링, 인사이트 추출, 콘텐츠 보강 |
| **planning** | 13 | 작업, 실행 계획, 진행 추적, 서버측 에이전트 실행 |
| **analysis** | 5 | 전체 분석 실행, 결과에서 스펙 생성 |
| **crowd-intelligence** | 2 | 비동기 크라우드 리서치와 작업 폴링 |
| **spec-delivery** | 3 | 크라우드 피드백의 실행 가능한 스펙 탐색 및 선점 |
| **sessions** | 3 | 멀티 에이전트 조율 |
| **setup** | 3 | 보드 관리, 프로젝트 목록, 마이그레이션 |
| **agent-network** | 2 | 에이전트 등록, 기능 발견 |

추가로 9개의 **워크플로우 팩**이 활성화 시 SKILL.md를 통해 전문 방법론을 제공합니다:
- knowledge-base, competitive-analysis, content-strategy, content-creator, data-storytelling, heuristic-evaluation, market-research-reports, user-stories, ux-researcher

전체 도구 레퍼런스: **[docs/TOOLS.md](docs/TOOLS.md)**

### 지식 베이스

매 에이전트 상호작용이 지식 베이스를 더 좋게 만듭니다. 시스템은 복리 루프로 작동합니다:

```
 save()          Supabase              ~/.crowdlisten/context/
───────→  memories 테이블  ──렌더──→  ├── INDEX.md
                                      ├── entries/a1b2c3d4.md
 recall()        ↑                    └── topics/auth.md
←────────────────┘
                                      sync_context({ organize: true })
 sync_context()                       중복 감지,
 로컬 재구축 ←──── 전체 풀 ────── 주제별 그룹화,
 .md 캐시                             합성 제안
```

**데이터 흐름:**

1. **저장** — `save({ title, content, tags })`는 Supabase에 기록하고 YAML 프론트매터가 포함된 `.md` 파일을 로컬에 렌더링
2. **리콜** — `recall({ search })`는 시맨틱 검색(pgvector 코사인 유사도)으로 Supabase를 쿼리하며, 키워드 매칭으로 폴백. 구조화된 탐색은 `~/.crowdlisten/context/INDEX.md`를 직접 읽기
3. **동기화** — `sync_context()`는 클라우드에서 모든 항목을 풀하고 전체 로컬 `.md` 폴더를 재구축. 웹 업로드나 기기 전환 후 사용. `organize: true`를 전달하면 근사 중복 감지(Jaccard 유사도), 3개 이상 항목의 주제 식별, 합성이나 정리가 필요한 항목 보고서 반환
4. **퍼블리시** — `publish_context({ memory_id, team_id })`로 팀원과 항목 공유. 다음 `sync_context` 시 INDEX.md의 `## Shared` 섹션에 풀됨

**복리 효과:** 매 분석이나 리서치 작업 후 에이전트가 핵심 요점 2-3개를 저장합니다. 시간이 지나면 `sync_context({ organize: true })`가 이를 주제별로 그룹화합니다. 에이전트가 주제를 정제된 요약으로 합성합니다. 다음 에이전트는 풍부한 INDEX.md로 시작하며, 빈 슬레이트가 아닙니다.

Supabase가 유일한 진실 소스입니다. 로컬 `.md` 폴더는 읽기 전용 렌더링 캐시입니다 — 동기화 충돌도, 병합 이슈도 없습니다.

### 플랫폼

| 플랫폼 | 설정 | 비고 |
|--------|------|------|
| Reddit | 없음 | 즉시 사용 가능 |
| TikTok, Instagram, Xiaohongshu | `npx playwright install chromium` | 브라우저 기반 추출 |
| Twitter/X | `.env`에 `TWITTER_USERNAME` + `TWITTER_PASSWORD` | 자격 증명 기반 |
| YouTube | `.env`에 `YOUTUBE_API_KEY` | API 키 필요 |
| 비전 모드 (모든 URL) | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, 또는 `OPENAI_API_KEY` 중 하나 | 스크린샷 + LLM 추출 |

### 지원 에이전트

**로그인 시 자동 설정:** Claude Code, Cursor, Gemini CLI, Codex, Amp, OpenClaw

**수동 설정으로도 사용 가능:** Copilot, Droid, Qwen Code, OpenCode

## CLI

```bash
npx @crowdlisten/harness login          # 로그인 + 에이전트 자동 설정
npx @crowdlisten/harness setup          # 자동 설정 재실행
npx @crowdlisten/harness serve          # HTTP 서버 시작 :3848

npx crowdlisten search reddit "AI agents" --limit 20
npx crowdlisten vision https://news.ycombinator.com --limit 10
npx crowdlisten trending reddit --limit 10
```

## 프라이버시

- LLM 호출 전 로컬에서 PII 제거
- 행 수준 보안으로 메모리 저장 — 사용자는 자신의 데이터만 접근 가능
- 클라우드 불가 시 로컬 폴백
- LLM 추출에 사용자 자체 API 키 사용
- 명시적 행동 없이 데이터 동기화 없음
- MIT 오픈 소스, 코드 검사 가능

## 개발

```bash
git clone https://github.com/Crowdlisten/crowdlisten_harness.git
cd crowdlisten_harness
npm install && npm run build
npm test    # 210+ tests via Vitest
```

에이전트가 읽을 수 있는 기능 설명과 예제 워크플로우는 [AGENTS.md](AGENTS.md)를 참조하세요.

## 기여

가장 가치 있는 기여: 새 플랫폼 어댑터(Threads, Bluesky, Hacker News, Product Hunt, Mastodon)와 추출 버그 수정.

## 라이선스

MIT — [crowdlisten.com](https://crowdlisten.com)
