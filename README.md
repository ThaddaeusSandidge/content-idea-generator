# Content Idea Generator

Turn the week's web and repository signals into creator-ready content ideas,
delivered as a GitHub Issue. It runs entirely in GitHub Actions: no server,
database, dashboard, or hosting required.

## Use it

Create `.github/workflows/content-ideas.yml` in the repository where you want
the Issues to appear:

```yaml
name: Weekly Content Ideas

on:
  schedule:
    - cron: "0 13 * * 1"
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  ideas:
    runs-on: ubuntu-latest
    steps:
      - uses: ThaddaeusSandidge/content-idea-generator@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          github-token: ${{ github.token }}
          niche: Short-form technology education for developers
          languages: typescript,swift,python
```

Then:

1. Create an OpenAI Platform API key.
2. In the consumer repository, open **Settings → Secrets and variables →
   Actions**.
3. Add the key as a repository secret named `OPENAI_API_KEY`.

Run the workflow manually once to verify the configuration. OpenAI API usage is
billed to the API-key owner; GitHub-hosted runner usage is subject to the
consumer's GitHub plan.

## What it gathers

The action gathers enabled sources concurrently and normalizes them before one
OpenAI Responses API request:

- **Hacker News:** current front-page titles, URLs, and points from the Algolia
  HN API.
- **GitHub new and rising:** repositories created in the last seven days,
  searched by configured language and sorted by stars.
- **Reddit:** the weekly top Atom feed for each configured subreddit. Feed
  order is retained as rank; Reddit's public JSON endpoint is not used. Feeds
  are requested sequentially with rate-limit-aware retry behavior.
- **Recent commits:** commit subjects from the current repository over the last
  seven days.

One unavailable source produces a warning and the run continues. If every
enabled source fails or returns no usable data, the action fails before calling
OpenAI or creating an Issue.

Every execution creates one new Issue. Manual reruns therefore intentionally
create another Issue.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `openai-api-key` | Yes | — | OpenAI key supplied from a repository secret. |
| `github-token` | No | `${{ github.token }}` | Token for searches, commits, labels, and Issues. |
| `niche` | No | Generic technology and coding content | Creator niche and audience context. |
| `languages` | No | `typescript,swift,python` | Up to 10 comma-separated GitHub languages. |
| `subreddits` | No | `programming,webdev,ExperiencedDevs` | Up to 10 comma-separated communities. |
| `num-ideas` | No | `10` | Number of ideas, from 1 through 25. |
| `issue-label` | No | `content-ideas` | Label applied to generated Issues. |
| `sources` | No | `hackernews,github,reddit,commits` | Enabled source list. |
| `model` | No | `gpt-5.6-luna` | OpenAI model supporting Structured Outputs. |

Valid source names are `hackernews`, `github`, `reddit`, and `commits`.

## Outputs

| Output | Description |
| --- | --- |
| `issue-number` | Number of the created Issue. |
| `issue-url` | URL of the created Issue. |
| `ideas-count` | Number of ideas written to the Issue. |

## Security

- The action masks the OpenAI key immediately and never logs it.
- Web titles, descriptions, and commit messages are delimited as untrusted
  reference data in the model prompt.
- The workflow needs `issues: write` to create the output Issue and
  `contents: read` to read recent commits.
- GitHub does not expose repository secrets to workflows triggered by pull
  requests from forks. This action is intended for `schedule` and
  `workflow_dispatch`.
- Keep API keys in repository or organization secrets. Never commit them or
  pass them as plain workflow values.

## Customize or fork

Most users should reference the Marketplace action directly. Forking is
optional and useful when adding another signal adapter. A source implements a
small loader returning normalized `{ source, title, url?, meta }` items; source
failures are isolated by the aggregator.

## Development

Requires Node.js 24:

```bash
npm ci
npm run typecheck
npm test
npm run build
git diff --exit-code -- dist
```

`dist/` is committed because GitHub executes the bundle without installing
dependencies at runtime. Pull-request CI rebuilds it and fails when it differs
from `src/`.

To deliberately check the live public data sources:

```bash
node scripts/smoke-sources.mjs
```

Live source health is not part of deterministic unit tests.

## Release

1. Verify CI and a manual end-to-end workflow run.
2. Tag an immutable release such as `v1.0.0`.
3. Move the `v1` major tag to the same commit.
4. Create a GitHub release and publish it to GitHub Marketplace.

## License

MIT
