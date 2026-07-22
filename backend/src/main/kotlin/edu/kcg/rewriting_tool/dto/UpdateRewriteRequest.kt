package edu.kcg.rewriting_tool.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class UpdateRewriteRequest(
    @field:NotBlank(message = "Original text is required.")
    val originalText: String,

    @field:NotBlank(message = "Rewritten text is required.")
    val rewrittenText: String,

    val mode: RewriteMode,

    @field:Size(max = 30, message = "Avoid list can contain at most 30 words or phrases.")
    val avoidWords: List<
        @Size(max = 120, message = "Each avoided word or phrase must be 120 characters or fewer.")
        String,
    >? = null,

    val vocabularySuggestions: Map<String, List<String>>? = null,
)
