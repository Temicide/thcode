# thcode

Benchmarking Thai LLMs on agentic coding tasks.

## About

thcode evaluates how well Thai-language large language models perform when used as the backbone for agentic AI coding tools like [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenAI Codex](https://openai.com/codex), and [opencode](https://opencode.ai).

As Thai LLMs continue to develop, there's limited data on their practical utility for complex, multi-step software engineering tasks. This project aims to fill that gap by running standardized agentic workflows against real codebases and measuring results.

## Models Under Evaluation

| Model          | Parameters | Notes |
| -------------- | ---------- | ----- |
| Typhoon-2.5    | 30B        |       |
| OpenThaiGPT-R1 | 32B        |       |
| Pathumma-LLM   | 7B         |       |
| ThaLLE-0.1     | 7B         |       |

## Roadmap

- [ ] Define evaluation harness and scoring criteria
- [ ] Set up reproducible test environments
- [ ] Run benchmarks across all models
- [ ] Publish results and analysis
- [ ] Expand to additional Thai LLMs

## Contributing

Contributions are welcome. Open an issue to discuss proposed changes or additions.

## License

TBD
