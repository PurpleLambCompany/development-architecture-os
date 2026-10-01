# Architecture Intelligence evaluation: pipeline (fake adapter), 2026-10-01

Seed data only (synthetic engagements). Metadata only: no prompt, context or output text (OD-14).

- Generation policy: v2 (`a283d9bb80c4e9ce4b22a9f175eabe737b0054f4f6483fb1f5b9dc2f0a1a7e05`)
- Tool contract version: 2
- Provider: fake; requested model: dsa-fake-model-1

| Kind                | Prompt version | Content hash                                                       |
| ------------------- | -------------- | ------------------------------------------------------------------ |
| explanation         | v2             | `b1db6026407791d40343081c947f8365ae032ebe92189a98993d04cfe55eca16` |
| tension             | v2             | `0d479a09400940a954bb580aceaca27cc59e54af53a22fc420e98e8577349308` |
| evidence_bearing    | v2             | `7242c2a95abf11de6569b64b0e0ac670cbb9234818e490d86bb43bb7838a6035` |
| review_brief        | v2             | `21a6c15588b40439abee2cb3d0b0d2339b9ea87667c9831852cc4bb23fe13a5f` |
| realization_reading | v2             | `40ff577c535a0499186cc24fa6db404bb9ae85db24f116b8cb8c7fdf6b607e0c` |

| Case                                         | Kind                | Outcome                 | Automated checks                     | Resolved model                 |
| -------------------------------------------- | ------------------- | ----------------------- | ------------------------------------ | ------------------------------ |
| explanation of an impact trace               | explanation         | persisted               | pass                                 | dsa-fake-model-1               |
| explanation of a substantive revision        | explanation         | persisted               | pass                                 | dsa-fake-model-1               |
| explanation of a Development Edge item       | explanation         | persisted               | pass                                 | dsa-fake-model-1               |
| tension across a typed relationship          | tension             | persisted               | pass                                 | dsa-fake-model-1               |
| evidence bearing (injection-bearing element) | evidence_bearing    | persisted               | pass                                 | dsa-fake-model-1               |
| review brief                                 | review_brief        | persisted               | pass                                 | dsa-fake-model-1               |
| realization reading                          | realization_reading | persisted               | pass                                 | dsa-fake-model-1               |
| Researcher without use                       | explanation         | refused_capability      | pass                                 | (none: refused before sending) |
| Use capability revoked mid-invocation        | explanation         | authorization_withdrawn | pass                                 | dsa-fake-model-1               |
| Unauthorized engagement                      | explanation         | refused_authorization   | pass                                 | (none: refused before sending) |
| Mode off                                     | explanation         | refused_mode            | pass                                 | (none: refused before sending) |
| Resolved model changed                       | explanation         | model_not_evaluated     | pass                                 | dsa-fake-model-2               |
| Budget below the request estimate            | explanation         | refused_budget          | pass                                 | (none: refused before sending) |
| Authorization revoked mid-invocation         | explanation         | authorization_withdrawn | pass                                 | dsa-fake-model-1               |
| New version published under a basis          | tension             | persisted               | then stale (newer_version_published) | dsa-fake-model-1               |

Manual quality grading: not applicable to the fake adapter.
