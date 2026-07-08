from __future__ import annotations


def draft_layout_from_text(prompt: str) -> dict:
    cleaned = prompt.strip()
    return {
        "status": "stub",
        "message": "AI 户型生成功能已预留接口，当前返回草案描述。",
        "prompt": cleaned,
        "suggestion": "建议先基于前端模板起步，再在后续版本接入文本生成布局。"
    }

