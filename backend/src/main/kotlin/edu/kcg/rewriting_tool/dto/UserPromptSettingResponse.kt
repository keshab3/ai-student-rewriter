package edu.kcg.rewriting_tool.dto

import java.time.LocalDateTime

data class UserPromptSettingResponse(
    val mode: RewriteMode,
    val label: String,
    val description: String,
    val promptInstruction: String,
    val outputInstruction: String,
    val defaultPromptInstruction: String,
    val defaultOutputInstruction: String,
    val customized: Boolean,
    val updatedAt: LocalDateTime,
)
