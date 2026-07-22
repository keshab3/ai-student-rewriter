package edu.kcg.rewriting_tool.dto

import java.time.LocalDateTime

data class PromptSettingResponse(
    val mode: RewriteMode,
    val label: String,
    val description: String,
    val promptInstruction: String,
    val outputInstruction: String,
    val enabled: Boolean,
    val updatedAt: LocalDateTime,
)
