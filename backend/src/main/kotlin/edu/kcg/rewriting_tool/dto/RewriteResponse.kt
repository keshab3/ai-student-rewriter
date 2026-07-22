package edu.kcg.rewriting_tool.dto

import java.time.LocalDateTime

data class RewriteResponse(
    val id: Long,
    val originalText: String,
    val rewrittenText: String,
    val mode: RewriteMode,
    val modeLabel: String,
    val vocabularySuggestions: Map<String, List<String>> = emptyMap(),
    val avoidWords: List<String> = emptyList(),
    val matchedAvoidWords: List<String> = emptyList(),
    val evaluation: RewriteEvaluationResponse? = null,
    val createdAt: LocalDateTime,
)
