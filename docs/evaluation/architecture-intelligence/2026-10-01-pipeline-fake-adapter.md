# Architecture Intelligence evaluation: pipeline (fake adapter), 2026-10-01

Seed data only (synthetic engagements). Metadata only: no prompt, context or output text (OD-14).

- Generation policy: v1 (`e2ea9c5beb70c5b869ccb05c2e1e3101b0b564d97d63c7e635020d661df65adb`)
- Tool contract version: 1
- Provider: fake; requested model: dsa-fake-model-1

| Kind                | Prompt version | Content hash                                                       |
| ------------------- | -------------- | ------------------------------------------------------------------ |
| explanation         | v1             | `0681321abaf793191508f9acd6ded8ec69cbb6b2ed8e2b08bbb5310ec216522b` |
| tension             | v1             | `9e27665553a947bf50e34d74207312ebd4c9dbd65c5b6584cf9605bdabe8075d` |
| evidence_bearing    | v1             | `cda6e1c3c92b332033f0d0cba85b49dd50667cc71b5e1de59acb86f6a1a5775a` |
| review_brief        | v1             | `05923f98e590dff96bbd0cf8ad2321f61116218649116b78c19f79cdc10d9cd8` |
| realization_reading | v1             | `ab3da3face35cec1743d692b4d2fea40770f672409839716d43160f2538b1224` |

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
